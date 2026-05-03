import { NextResponse } from "next/server";

// Phase 6 — Gmail
// Returns last N unread mails: { subject, from, snippet, date }[]
export async function GET() {
  return NextResponse.json({ error: "Not implemented yet — Phase 6" }, { status: 501 });
}
