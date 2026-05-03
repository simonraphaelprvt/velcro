import { NextResponse } from "next/server";

// Phase 4 — ElevenLabs TTS
// Receives: { text: string }
// Returns: audio/mpeg stream
export async function POST() {
  return NextResponse.json({ error: "Not implemented yet — Phase 4" }, { status: 501 });
}
