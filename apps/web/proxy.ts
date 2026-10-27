import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Controllo ottimistico (solo cookie): l'autorizzazione vera sta in requireSession().
// /api/auth, /api/v1 e /mcp usano le proprie credenziali (sessione Better Auth o chiave API).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|api/v1|mcp|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
