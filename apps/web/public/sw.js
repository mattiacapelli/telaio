/*
 * Service Worker di Telaio.
 *
 * Regole di sicurezza (non cambiarle senza rivedere docs/pwa.md):
 *  - mette in cache SOLO risorse statiche pubbliche, uguali per tutti gli utenti:
 *    /_next/static/*, /icons/* e la pagina /offline.html;
 *  - non mette MAI in cache HTML, dati RSC, /api/*, /mcp, azioni dei form o qualunque risposta autenticata;
 *  - le richieste non GET e quelle verso altri domini non vengono toccate;
 *  - non chiama skipWaiting da solo: il nuovo worker si attiva solo quando l'utente lo chiede.
 */
const VERSIONE = "v1";
const CACHE = `telaio-static-${VERSIONE}`;
const PREFISSO = "telaio-";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];
const MAX_VOCI = 250;

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const chiave of await caches.keys()) {
        if (chiave.startsWith(PREFISSO) && chiave !== CACHE) await caches.delete(chiave);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  const tipo = evento.data && evento.data.type;
  if (tipo === "SKIP_WAITING") self.skipWaiting();
  if (tipo === "PULISCI_CACHE") {
    // Si svuota tutto e si rimette solo la pagina offline: senza, la rete assente non avrebbe fallback.
    evento.waitUntil(
      (async () => {
        for (const k of await caches.keys()) if (k.startsWith(PREFISSO)) await caches.delete(k);
        await (await caches.open(CACHE)).addAll(PRECACHE).catch(() => {});
      })(),
    );
  }
});

async function limita(cache) {
  const chiavi = await cache.keys();
  for (const richiesta of chiavi.slice(0, Math.max(0, chiavi.length - MAX_VOCI)))
    await cache.delete(richiesta);
}

/** I file di /_next/static hanno l'hash nel nome: una volta in cache non cambiano mai. */
async function primaLaCache(richiesta) {
  const cache = await caches.open(CACHE);
  const trovata = await cache.match(richiesta);
  if (trovata) return trovata;
  const risposta = await fetch(richiesta);
  if (risposta.ok && risposta.type === "basic") {
    await cache.put(richiesta, risposta.clone());
    await limita(cache);
  }
  return risposta;
}

/** Le icone possono cambiare (logo definitivo): si serve la copia e si aggiorna in background. */
async function copiaPoiAggiorna(richiesta) {
  const cache = await caches.open(CACHE);
  const trovata = await cache.match(richiesta);
  const aggiornamento = fetch(richiesta)
    .then((risposta) => {
      if (risposta.ok && risposta.type === "basic") cache.put(richiesta, risposta.clone());
      return risposta;
    })
    .catch(() => trovata);
  return trovata || aggiornamento;
}

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET" || richiesta.headers.has("range")) return;
  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return;

  // Pagine: sempre dalla rete. Se la rete manca, una pagina statica senza dati né operazioni.
  if (richiesta.mode === "navigate") {
    evento.respondWith(fetch(richiesta).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(primaLaCache(richiesta));
    return;
  }
  if (url.pathname.startsWith("/icons/")) {
    evento.respondWith(copiaPoiAggiorna(richiesta));
  }
  // Tutto il resto (RSC, /api, /mcp, immagini dinamiche…) passa dalla rete senza memorizzare nulla.
});
