import { NextResponse } from "next/server";

// Phase 7 — Write note to Obsidian Vault via local_writer.py webhook
// Receives: { title: string, content: string }
// Forwards to LOCAL_WRITER_URL webhook on Simon's Mac
export async function POST() {
  return NextResponse.json({ error: "Not implemented yet — Phase 7" }, { status: 501 });
}
