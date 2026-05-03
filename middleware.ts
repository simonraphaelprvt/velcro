import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("velcro_auth")?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret || token !== secret) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except login page, auth API, and Next.js internals
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
