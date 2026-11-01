# Telaio come PWA

Telaio si può installare come app (desktop e telefono) e si usa in una finestra propria. Resta
un'applicazione che parla sempre con il server: **offline non si lavora**, e questo è voluto.

## Cosa c'è

| Funzione                                             | Dove                                                     |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Manifest (nome, colori, icone, scorciatoie dell'app) | `apps/web/app/manifest.ts` → `/manifest.webmanifest`     |
| Icone                                                | `apps/web/public/icons/` (generate, vedi sotto)          |
| Service Worker                                       | `apps/web/public/sw.js`                                  |
| Pagina offline                                       | `apps/web/public/offline.html`                           |
| Registrazione, avviso di aggiornamento               | `components/pwa/aggiornamento-pwa.tsx`                   |
| Installazione (menu account), istruzioni iOS         | `lib/installazione.ts`, `components/shell/user-menu.tsx` |
| Indicatore online/offline, blocco dei moduli         | `components/pwa/stato-rete.tsx`                          |
| Badge sull'icona (azioni in attesa)                  | `components/pwa/badge-app.tsx`                           |
| Pulizia cache a login e logout                       | `lib/pwa.ts`                                             |
| Scorciatoie da tastiera (`G` + lettera, `?`)         | `components/shell/scorciatoie.tsx`                       |
| Tema chiaro/scuro/sistema                            | `lib/tema.ts`, token in `app/globals.css`                |

Manifest, icone, `sw.js` e `offline.html` sono pubblici (esclusi dal controllo di sessione in
`proxy.ts`): servono prima del login. Le pagine restano protette.

## Service Worker

- **Solo in produzione.** In sviluppo non si registra; se ne trova uno rimasto, lo disinstalla e svuota le cache.
- **Cache solo di risorse statiche pubbliche**: `/_next/static/*` (cache-first), `/icons/*`
  (copia + aggiornamento in background) e `/offline.html`.
- **Mai in cache**: HTML, RSC, `/api`, `/mcp`, documenti, qualsiasi dato autenticato. Le pagine
  passano sempre dalla rete; se la rete manca, compare `offline.html`.
- La pagina offline non ha moduli né dati e non esegue nulla. Anche i moduli dell'app, da offline,
  vengono bloccati con un avviso: nessuna operazione parte senza che il server possa confermarla.
- **Cambio account**: a login e logout le cache `telaio-*` vengono svuotate (resta solo la pagina
  offline). Nelle cache non ci sono dati di nessun utente, quindi nulla può passare da un account all'altro.
- **Aggiornamenti solo su richiesta.** Un nuovo worker resta in attesa; compare un avviso e
  «Aggiorna» lo attiva. Se in un modulo ci sono modifiche non salvate si chiede conferma
  («Aggiorna comunque»). La sessione non si perde: il cookie non dipende dal worker.
  Per far scattare un aggiornamento basta cambiare `VERSIONE` in `sw.js`.

## Installazione

Nessun popup. La voce **Installa applicazione** compare nel menu dell'account solo se il browser
rende l'app installabile e non è già aperta come app. Su iPhone/iPad la voce **Aggiungi alla
schermata Home** apre le istruzioni (Condividi → Aggiungi alla schermata Home).

## Icone

Il logo è `apps/web/public/icons/logo.png`. Per cambiarlo, sostituire il file e lanciare:

```bash
pnpm --filter @telaio/web icone
```

Genera icone normali (192, 512), maskable, monocromatica e Apple. Lo script ritaglia il
quadrato centrale della placca nera (`RITAGLIO` in `scripts/genera-icone.mjs`): da rivedere solo
se cambia la proporzione del disegno.

## Compatibilità

Provato direttamente solo su **Chromium** (Playwright, con server di produzione). Il resto è
descritto dalle specifiche e dalla documentazione dei browser, **non verificato su dispositivi reali**.

| Funzione                       | Chrome / Chromium desktop                                       | Edge           | Safari macOS                        | Safari iOS/iPadOS             | Chrome Android |
| ------------------------------ | --------------------------------------------------------------- | -------------- | ----------------------------------- | ----------------------------- | -------------- |
| Service Worker, pagina offline | verificato                                                      | non verificato | non verificato                      | non verificato                | non verificato |
| Installazione dal menu         | verificato con evento simulato; nessun errore di installabilità | non verificato | no: da Safari 17 «Aggiungi al Dock» | no: solo manuale da Condividi | non verificato |
| Badge sull'icona (App Badging) | disponibile da app installata                                   | non verificato | non verificato                      | non verificato                | non supportato |
| Margini sicuri, `dvh`          | verificato con notch simulato                                   | non verificato | non verificato                      | non verificato                | non verificato |
| Tema scuro                     | verificato                                                      | non verificato | non verificato                      | non verificato                | non verificato |

Limiti da conoscere:
- `beforeinstallprompt` esiste solo nei browser Chromium: gli altri non mostrano la voce «Installa»
  (su iOS compare quella con le istruzioni).
- Il tema della barra (`theme-color`) segue il sistema; il manifest ne ammette uno solo (bianco).
- `navigator.onLine` dice se c'è una rete, non se il server risponde: l'indicatore può restare
  «online» con la rete senza internet. In quel caso la pagina offline compare comunque alla
  navigazione e il server rifiuta ogni operazione.
- Safari cancella i dati di un sito non usato per qualche settimana; l'app installata ne è esclusa.

## Rimandato

- **Notifiche push** (Web Push): serve una chiave VAPID, una tabella di sottoscrizioni e un job
  di invio. Da affrontare a parte; rispetterebbe comunque la regola che i solleciti non partono
  senza conferma.
- Condivisione, schermo intero e lavoro offline con sincronizzazione: non previsti.
