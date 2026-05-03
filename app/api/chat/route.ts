import { NextResponse } from "next/server";

// Phase 3 — Claude chat with Vault context
// Receives: { query: string, history?: Message[] }
// Returns: Server-Sent Events stream of Claude response
export async function POST() {
  return NextResponse.json({ error: "Not implemented yet — Phase 3" }, { status: 501 });
}
