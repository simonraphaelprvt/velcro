import { NextRequest, NextResponse } from "next/server";
import { exchangeSpotifyCode } from "@/lib/spotify";

// Spotify redirects here after consent. Exchanges the code for tokens.
export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.json(
      { error: error ?? "Kein Code erhalten." },
      { status: 400 }
    );
  }

  try {
    await exchangeSpotifyCode(code);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("Spotify OAuth callback error:", err);
    const msg = err instanceof Error ? err.message : "OAuth fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
