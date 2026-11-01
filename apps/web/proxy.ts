import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Controllo ottimistico (solo cookie): l'autorizzazione vera sta in requireSession().
// Manifest, icone, Service Worker e pagina offline sono pubblici: servono all'installazione prima del login.
// /api/auth, /api/v1 e /mcp usano le proprie credenziali (sessione Better Auth o chiave API).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/v1|mcp|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:png|svg|jpg|ico)$).*)",
  ],
};
