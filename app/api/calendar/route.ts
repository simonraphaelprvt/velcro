import { NextResponse } from "next/server";

// Phase 6 — Google Calendar
// Receives: { start: string (ISO), end: string (ISO) }
// Returns: { events: CalendarEvent[] }
export async function GET() {
  return NextResponse.json({ error: "Not implemented yet — Phase 6" }, { status: 501 });
}
