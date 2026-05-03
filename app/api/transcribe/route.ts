import { NextResponse } from "next/server";

// Phase 4 — Whisper transcription
// Receives: multipart/form-data with an "audio" field (webm/wav blob)
// Returns: { text: string }
export async function POST() {
  return NextResponse.json({ error: "Not implemented yet — Phase 4" }, { status: 501 });
}
