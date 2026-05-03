import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "velcro_auth";

// Timing-safe string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isAuthenticated(req?: NextRequest): boolean {
  const cookieStore = req
    ? req.cookies
    : // Server component usage
      null;

  const token = cookieStore
    ? cookieStore.get(COOKIE_NAME)?.value
    : // This branch runs in Server Components via next/headers
      null;

  if (!token) return false;
  return safeEqual(token, process.env.AUTH_SECRET!);
}

export function setAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: process.env.AUTH_SECRET!,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  };
}
