import { getDb, leggiStatoSetup } from "@telaio/db";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Prima configurazione: finché non è completata si può raggiungere solo /setup (e gli asset pubblici
// esclusi dal matcher), tutto il resto rimanda lì. Dopo il completamento /setup rimanda a login o
// dashboard. Lo stato è nel database; una volta completato non torna mai indietro, quindi si
// ricorda e non si interroga più. Se il database non risponde non si reindirizza: ci pensano le pagine.
let configurato = false;

async function setupCompletato(): Promise<boolean | null> {
  if (configurato) return true;
  try {
    const stato = await leggiStatoSetup(getDb());
    if (stato.completato) configurato = true;
    return stato.completato;
  } catch {
    return null;
  }
}

// Controllo ottimistico (solo cookie): l'autorizzazione vera sta in requireSession().
// Manifest, icone, Service Worker e pagina offline sono pubblici: servono all'installazione prima del login.
// /login decide da sé dove andare (verso /setup se serve). /api/health risponde ai controlli di Docker e
// del proxy, senza dati. /api/auth, /api/v1 e /mcp usano le proprie credenziali (sessione Better Auth o chiave API).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const inSetup = pathname === "/setup" || pathname.startsWith("/setup/");
  const completato = await setupCompletato();

  if (completato === false && !inSetup)
    return NextResponse.redirect(new URL("/setup", request.url));
  if (inSetup) {
    // Le richieste che non sono GET (le Server Actions del wizard) arrivano comunque alle azioni,
    // che rifiutano da sole il setup già completato: un redirect su un POST non servirebbe.
    if (completato === true && (request.method === "GET" || request.method === "HEAD")) {
      const destinazione = getSessionCookie(request) ? "/" : "/login";
      return NextResponse.redirect(new URL(destinazione, request.url));
    }
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|api/v1|mcp|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:png|svg|jpg|ico)$).*)",
  ],
};
