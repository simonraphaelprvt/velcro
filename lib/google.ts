import { google } from "googleapis";
import { getServiceSupabase } from "@/lib/supabase";
import type { CalendarEvent, MailSummary } from "@/lib/types";

const SCOPES = [
  // events scope includes read AND write — replaces the old readonly scope
  "https://www.googleapis.com/auth/calendar.events",
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
  const { error } = await db.from("google_tokens").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase saveTokens: ${error.message} (code: ${error.code})`);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const db = getServiceSupabase();
  const { data, error } = await db.from("google_tokens").select("*").eq("id", 1).single();
  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found — expected when not yet connected
    throw new Error(`Supabase loadTokens: ${error.message} (code: ${error.code})`);
  }
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

export async function getRecentMails(limit = 10, query = "in:inbox"): Promise<MailSummary[]> {
  const auth = await getAuthedClient();
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch list of recent messages matching query
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: limit,
    q: query,
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

// ---------------------------------------------------------------------------
// Calendar — Write
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  title:        string;
  start:        string; // ISO datetime
  end:          string; // ISO datetime
  description?: string;
  location?:    string;
  attendees?:   string[];
}

export async function createCalendarEvent(input: CreateEventInput): Promise<CalendarEvent> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.insert({
    calendarId: "primary",
    requestBody: {
      summary:     input.title,
      description: input.description,
      location:    input.location,
      start:       { dateTime: input.start, timeZone: "Europe/Berlin" },
      end:         { dateTime: input.end,   timeZone: "Europe/Berlin" },
      attendees:   input.attendees?.map((email) => ({ email })),
    },
  });

  const e = res.data;
  return {
    id:    e.id ?? "",
    title: e.summary ?? input.title,
    start: e.start?.dateTime ?? input.start,
    end:   e.end?.dateTime ?? input.end,
    location:    e.location ?? undefined,
    description: e.description ?? undefined,
  };
}

/**
 * Search Gmail by free-text query (Gmail search syntax).
 * Used by Call Prep to find recent threads with a specific person.
 * Examples: "from:karin@example.com", "Karin Müller", "to:simon Porsche".
 */
export async function searchMails(query: string, limit = 8): Promise<MailSummary[]> {
  return getRecentMails(limit, query);
}

/**
 * Search past + upcoming calendar events for a free-text needle (e.g. a name).
 * Used by Call Prep to surface past meetings with a person.
 * Window: 6 months back to 1 week forward.
 */
export async function searchPastEvents(needle: string, limit = 8): Promise<CalendarEvent[]> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: "v3", auth });

  const now = Date.now();
  const sixMonthsAgo = new Date(now - 1000 * 60 * 60 * 24 * 180).toISOString();
  const oneWeekAhead = new Date(now + 1000 * 60 * 60 * 24 * 7).toISOString();

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: sixMonthsAgo,
    timeMax: oneWeekAhead,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: limit,
    q: needle,
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
