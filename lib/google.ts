import { google } from "googleapis";
import { getServiceSupabase } from "@/lib/supabase";
import type { CalendarEvent, MailSummary } from "@/lib/types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // force refresh_token on every auth
  });
}

// ---------------------------------------------------------------------------
// Token persistence via Supabase (single row, id=1)
// ---------------------------------------------------------------------------

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const db = getServiceSupabase();
  await db.from("google_tokens").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    updated_at: new Date().toISOString(),
  });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const db = getServiceSupabase();
  const { data } = await db.from("google_tokens").select("*").eq("id", 1).single();
  if (!data) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
  };
}

// Returns an authenticated OAuth2 client, auto-refreshing if needed
export async function getAuthedClient() {
  const tokens = await loadTokens();
  if (!tokens?.refresh_token) {
    throw new Error("Google nicht verbunden. Besuche /api/auth/google zum Verbinden.");
  }

  const client = createOAuthClient();
  client.setCredentials(tokens);

  // Auto-refresh if access token is expired or expires within 5 minutes
  const expiresIn = tokens.expiry_date - Date.now();
  if (expiresIn < 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await saveTokens({
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? tokens.refresh_token,
      expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    });
  }

  return client;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export async function getCalendarEvents(
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: new Date(start).toISOString(),
    timeMax: new Date(end).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    title: e.summary ?? "(Kein Titel)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    location: e.location ?? undefined,
    description: e.description ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

export async function getRecentMails(limit = 10): Promise<MailSummary[]> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch list of recent messages (unread first, then any)
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: limit,
    q: "in:inbox",
  });

  const messageIds = listRes.data.messages ?? [];
  if (messageIds.length === 0) return [];

  // Fetch metadata for each message in parallel
  const mails = await Promise.all(
    messageIds.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const labelIds = msg.data.labelIds ?? [];

      return {
        id: m.id!,
        subject: get("Subject") || "(Kein Betreff)",
        from: get("From"),
        snippet: msg.data.snippet ?? "",
        date: get("Date"),
        unread: labelIds.includes("UNREAD"),
      };
    })
  );

  return mails;
}
