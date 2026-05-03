import { NextRequest, NextResponse } from "next/server";
import { getRecentMails } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);

  try {
    const mails = await getRecentMails(limit);
    return NextResponse.json({ mails });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
