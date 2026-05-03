import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start und end sind erforderlich (ISO-String)" }, { status: 400 });
  }

  try {
    const events = await getCalendarEvents(start, end);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
