import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));

  if (!password || password !== process.env.VELCRO_PASSWORD) {
    // Constant-time-ish delay to slow brute-force attempts
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Falsches Passwort." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const cookie = setAuthCookie();
  res.cookies.set(cookie);
  return res;
}
