import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth-cookie";

/**
 * Tutto è protetto tranne il login e le risorse statiche.
 *
 * Qui si controlla solo la presenza del cookie: il middleware gira su runtime
 * edge, dove Redis e Prisma non sono disponibili. La validità della sessione
 * viene verificata dal layout, che gira su Node.
 */
// Lo scheduler e il server MCP si autenticano con un token dedicato (header
// Authorization), non con il cookie di sessione: un processo interno o un
// agente esterno non deve dipendere da un login da browser. Il controllo
// vero resta nella route. La verifica licenza è pubblica per costruzione:
// la interroga il software installato presso il cliente, che non ha (né
// deve avere) una sessione Telaio.
const PUBBLICHE = ["/login", "/api/auth/login", "/api/scheduler", "/api/mcp", "/api/licenze/verifica"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBBLICHE.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (!req.cookies.get(COOKIE)) {
    // Le API rispondono in JSON: un redirect a una pagina HTML confonderebbe
    // il client, che si aspetta una risposta strutturata.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Dopo il login si torna dove si stava andando.
    if (pathname !== "/") url.searchParams.set("da", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
