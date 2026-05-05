import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify";

// Redirects Simon to the Spotify OAuth consent screen.
// Visit once at: /api/auth/spotify
export async function GET() {
  try {
    return NextResponse.redirect(getSpotifyAuthUrl());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
