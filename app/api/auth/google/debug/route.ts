import { NextResponse } from "next/server";
import { loadTokens, getAuthedClient } from "@/lib/google";
import { google } from "googleapis";

/**
 * Debug endpoint — call /api/auth/google/debug to see what's happening.
 * Shows: token state, Supabase connectivity, Calendar API test call.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    env: {
      GOOGLE_CLIENT_ID:      !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET:  !!process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI:   process.env.GOOGLE_REDIRECT_URI ?? "MISSING",
      SUPABASE_URL:          !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_KEY:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };

  // 1. Try loading tokens
  try {
    const tokens = await loadTokens();
    result.tokens = tokens
      ? {
          has_access_token:  !!tokens.access_token,
          has_refresh_token: !!tokens.refresh_token,
          expiry_date:       new Date(tokens.expiry_date).toISOString(),
          expired:           tokens.expiry_date < Date.now(),
        }
      : null;
  } catch (e) {
    result.tokens_error = String(e);
  }

  // 2. Try getting an authed client
  try {
    const client = await getAuthedClient();
    result.auth_client = "ok";

    // 3. Try a real Calendar API call
    try {
      const cal = google.calendar({ version: "v3", auth: client });
      const now = new Date();
      const res = await cal.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        maxResults: 1,
      });
      result.calendar_api = `ok — ${res.data.items?.length ?? 0} upcoming events found`;
    } catch (e) {
      result.calendar_api_error = String(e);
    }
  } catch (e) {
    result.auth_client_error = String(e);
  }

  return NextResponse.json(result, { status: 200 });
}
