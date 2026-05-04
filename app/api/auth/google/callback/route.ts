import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, saveTokens } from "@/lib/google";
import { setAuthCookie } from "@/lib/auth";

// Google redirects here after consent.
// Exchanges the auth code for tokens and saves them to Supabase.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.json(
      { error: error ?? "Kein Code erhalten." },
      { status: 400 }
    );
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            "Kein Refresh-Token. Entferne den App-Zugriff in Google Account Settings und verbinde erneut.",
        },
        { status: 400 }
      );
    }

    await saveTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    });

    // Set the VELCRO auth cookie so Google login = fully logged in
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(setAuthCookie());
    return res;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.json({ error: "OAuth fehlgeschlagen." }, { status: 500 });
  }
}
