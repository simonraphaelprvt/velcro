/**
 * Spotify Web API integration.
 *
 * Setup (one time):
 *   1. https://developer.spotify.com/dashboard → Create App
 *   2. Add Redirect URI: <APP_URL>/api/auth/spotify/callback
 *   3. Set env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI
 *   4. Run the migration in scripts/supabase_schema.sql to create spotify_tokens
 *   5. Visit /api/auth/spotify to authorize once
 *
 * Notes:
 *   - Playback control requires Spotify Premium.
 *   - Tokens auto-refresh on every authed call.
 */

import { getServiceSupabase } from "@/lib/supabase";

const AUTH_URL  = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE  = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "playlist-read-private",
].join(" ");

interface StoredTokens {
  access_token:  string;
  refresh_token: string;
  expiry_date:   number;
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function getSpotifyAuthUrl(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirect = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirect) {
    throw new Error("SPOTIFY_CLIENT_ID oder SPOTIFY_REDIRECT_URI fehlt.");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    scope:         SCOPES,
    redirect_uri:  redirect,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeSpotifyCode(code: string): Promise<StoredTokens> {
  const params = new URLSearchParams({
    grant_type:   "authorization_code",
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Spotify token exchange: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const tokens: StoredTokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  await saveSpotifyTokens(tokens);
  return tokens;
}

async function refreshAccessToken(refresh_token: string): Promise<StoredTokens> {
  const params = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Spotify token refresh: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    access_token:  data.access_token,
    // Refresh sometimes omits a new refresh_token — keep the old one.
    refresh_token: data.refresh_token ?? refresh_token,
    expiry_date:   Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Token persistence (single row, id=1)
// ---------------------------------------------------------------------------

async function saveSpotifyTokens(t: StoredTokens): Promise<void> {
  const db = getServiceSupabase();
  await db.from("spotify_tokens").upsert({
    id:            1,
    access_token:  t.access_token,
    refresh_token: t.refresh_token,
    expiry_date:   t.expiry_date,
    updated_at:    new Date().toISOString(),
  });
}

async function loadSpotifyTokens(): Promise<StoredTokens | null> {
  const db = getServiceSupabase();
  const { data } = await db.from("spotify_tokens").select("*").eq("id", 1).single();
  if (!data) return null;
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   data.expiry_date,
  };
}

async function getValidAccessToken(): Promise<string> {
  const tokens = await loadSpotifyTokens();
  if (!tokens?.refresh_token) {
    throw new Error("Spotify nicht verbunden. Besuchen Sie /api/auth/spotify.");
  }
  if (Date.now() < tokens.expiry_date - 60_000) {
    return tokens.access_token;
  }
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  await saveSpotifyTokens(refreshed);
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function spotifyFetch(
  path:   string,
  init: { method?: string; body?: object; query?: Record<string, string> } = {},
): Promise<Response> {
  const token = await getValidAccessToken();
  const params = init.query ? "?" + new URLSearchParams(init.query) : "";
  const res = await fetch(`${API_BASE}${path}${params}`, {
    method: init.method ?? "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return res;
}

export interface SpotifyTrack {
  name:    string;
  artist:  string;
  album:   string;
  uri:     string;
  duration: number; // seconds
}

export async function searchSpotify(query: string, limit = 5): Promise<SpotifyTrack[]> {
  const res = await spotifyFetch("/search", {
    query: { q: query, type: "track", limit: String(limit), market: "DE" },
  });
  if (!res.ok) throw new Error(`Spotify search: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.tracks?.items ?? []).map((t: {
    name: string; uri: string; duration_ms: number;
    artists: { name: string }[]; album: { name: string };
  }) => ({
    name:     t.name,
    artist:   (t.artists ?? []).map((a) => a.name).join(", "),
    album:    t.album?.name ?? "",
    uri:      t.uri,
    duration: Math.round((t.duration_ms ?? 0) / 1000),
  }));
}

export async function playSpotify(uri?: string, contextUri?: string): Promise<void> {
  const body: Record<string, unknown> = {};
  if (uri)        body.uris        = [uri];
  if (contextUri) body.context_uri = contextUri;

  const res = await spotifyFetch("/me/player/play", {
    method: "PUT",
    body,
  });
  if (res.status === 404) {
    throw new Error("Kein aktives Spotify-Geraet gefunden. Oeffnen Sie Spotify einmal.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify play: ${res.status} ${await res.text()}`);
  }
}

export async function pauseSpotify(): Promise<void> {
  const res = await spotifyFetch("/me/player/pause", { method: "PUT" });
  if (!res.ok && res.status !== 204 && res.status !== 403) {
    throw new Error(`Spotify pause: ${res.status} ${await res.text()}`);
  }
}

export async function resumeSpotify(): Promise<void> {
  const res = await spotifyFetch("/me/player/play", { method: "PUT" });
  if (res.status === 404) {
    throw new Error("Kein aktives Spotify-Geraet gefunden.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify resume: ${res.status} ${await res.text()}`);
  }
}

export async function nextSpotify(): Promise<void> {
  await spotifyFetch("/me/player/next", { method: "POST" });
}

export interface NowPlaying {
  isPlaying: boolean;
  track?: SpotifyTrack;
}

export async function getNowPlaying(): Promise<NowPlaying> {
  const res = await spotifyFetch("/me/player/currently-playing");
  if (res.status === 204) return { isPlaying: false };
  if (!res.ok) throw new Error(`Spotify now-playing: ${res.status}`);
  const data = await res.json();
  if (!data.item) return { isPlaying: data.is_playing ?? false };
  return {
    isPlaying: data.is_playing ?? false,
    track: {
      name:     data.item.name,
      artist:   (data.item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      album:    data.item.album?.name ?? "",
      uri:      data.item.uri,
      duration: Math.round((data.item.duration_ms ?? 0) / 1000),
    },
  };
}
