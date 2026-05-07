import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/google";

/** Returns whether a valid Google refresh token is stored. */
export async function GET() {
  try {
    const tokens = await loadTokens();
    return NextResponse.json({ connected: !!(tokens?.refresh_token) });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
