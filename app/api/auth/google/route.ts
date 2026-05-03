import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

// Redirects Simon to the Google OAuth consent screen.
// Visit once at: /api/auth/google
export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
