# Telaio

Gestionale commerciale per una persona sola (pensato per più utenti in futuro): preventivi, fatture, incassi, abbonamenti e prima nota. I clienti restano su **Twenty CRM**; Telaio ne tiene solo un riferimento.

Documentazione: [`docs/architettura.md`](docs/architettura.md) · [`docs/dominio.md`](docs/dominio.md) · [`docs/decisioni.md`](docs/decisioni.md).

## Avvio

Servono Node ≥ 22, pnpm e Docker.

```bash
pnpm i
cp .env.example .env          # poi adatta i valori
docker compose up -d          # Postgres, Redis, Mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev                      # web su http://localhost:3000 + worker
```

Accesso: l'utente creato dal seed (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, di default `mattia@telaio.local` / `telaio-dev-2026`). Mailpit: http://localhost:8026.

## Script

| Comando                            | Cosa fa                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`                         | web e worker in sviluppo                                                     |
| `pnpm build` / `pnpm typecheck`    | build e controllo dei tipi di tutti i pacchetti                              |
| `pnpm test`                        | test Vitest (`core`, `twenty`)                                               |
| `pnpm test:e2e`                    | smoke test Playwright sul login (richiede `npx playwright install chromium`) |
| `pnpm lint` / `pnpm format`        | Biome                                                                        |
| `pnpm db:generate`                 | genera una migrazione Drizzle dopo aver cambiato lo schema                   |
| `pnpm db:migrate` / `pnpm db:seed` | applica le migrazioni / dati di esempio (idempotente)                        |
| `pnpm --filter @telaio/worker job` | esegue una volta la generazione rate                                         |

## Variabili d'ambiente

| Variabile                                                    | Uso                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `DATABASE_URL`                                               | connessione PostgreSQL                                                     |
| `REDIS_URL`                                                  | code BullMQ e rate limit delle API                                         |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                      | segreto e URL pubblico per l'autenticazione (anche rpID delle passkey)     |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | utente creato dal seed                                                     |
| `TWENTY_API_URL`, `TWENTY_API_KEY`                           | Twenty CRM; se vuoti `/clienti` usa dati finti                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`                        | email dei solleciti (Mailpit in sviluppo)                                  |
| `BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_PG_DUMP`                | job di backup: cartella (`./backups`), file tenuti (14), comando `pg_dump` |

## Struttura

```
apps/web        Next.js: UI, Server Actions, /api/v1, /mcp
apps/worker     BullMQ: genera-rate, solleciti (solo bozze da confermare), sync-twenty, consegna-webhook, backup
packages/core   logica di dominio pura: IVA, bollo, ritenuta, split, rate, numerazioni
packages/db     schema Drizzle, migrazioni, seed
packages/twenty client REST tipizzato per Twenty
docs/           architettura, dominio, decisioni
```

## MCP e API

1. In **Impostazioni → API e webhook** crea una chiave (ambito `mcp` e/o `api`); la chiave si vede una sola volta.
2. Server MCP: `POST /mcp` con `Authorization: Bearer tlk_…`. 35 strumenti che coprono tutta l'app, raggruppati in Impostazioni → MCP: **generale** (`cerca`, `riepilogo`, `elenca_ragioni_sociali`), **clienti** (`cerca_clienti`, `dettaglio_cliente`, `elenca_opportunita`, `aggiorna_fase_opportunita`), **preventivi** (`listino`, `elenca_preventivi`, `dettaglio_preventivo`, `crea_preventivo`, `cambia_stato_preventivo`), **fatture** (`elenca_fatture`, `dettaglio_fattura`, `crea_fattura_da_preventivo`, `crea_fattura_libera`, `emetti_fattura`), **incassi e cassa** (`scadenzario`, `elenca_incassi`, `registra_incasso`, `elenca_conti`, `crea_conto`, `elenca_movimenti`, `registra_movimento`), **solleciti** (`elenca_solleciti`, `invia_sollecito`, `scarta_sollecito`), **abbonamenti** (`elenca_abbonamenti`, `dettaglio_abbonamento`, `crea_abbonamento`, `cambia_stato_abbonamento`), **analisi** (`cash_flow`, `report`, `elenca_azioni_in_attesa`), più `stato_azione` per leggere l'esito di ciò che hai approvato.
3. In **Impostazioni → MCP** scegli, per ogni strumento, se è attivo e se **aspetta la tua approvazione**. Predefinito: le scritture chiedono conferma (finiscono in **Azioni in attesa** e girano solo dopo il tuo ok), le letture no. Qualsiasi strumento, anche di lettura, può essere messo «con conferma». Fa eccezione `invia_sollecito` (manda un'email): chiede **sempre** la conferma.
4. API REST: `/api/v1/preventivi`, `/api/v1/clienti`; documento OpenAPI su `/api/v1/openapi`.

## Webhook, job e backup

- **Webhook**: in **Impostazioni → API e webhook** aggiungi un indirizzo e gli eventi (`preventivo.creato`, `preventivo.stato`, `fattura.emessa`, `incasso.registrato`, `abbonamento.creato`). Ogni consegna è un POST JSON con `x-telaio-signature: sha256=<HMAC-SHA256 del corpo>` (segreto mostrato una sola volta); il worker ritenta con pause crescenti (1, 5, 30, 120, 720 minuti).
- **Job una tantum**: `pnpm --filter @telaio/worker job <genera-rate|solleciti|sync-twenty|consegna-webhook|backup>`. Il backup richiede `pg_dump` (nell'immagine Docker c'è già).
- **Export**: `/api/export/commercialista?tipo=fatture|prima-nota&p=mese|trimestre|anno` (CSV), disponibile da Report e da Impostazioni → Backup ed export.

## PWA

Telaio si installa come app dal menu dell'account (su iPhone: Condividi → Aggiungi alla schermata
Home). Il Service Worker è attivo solo in produzione e mette in cache soltanto risorse statiche
pubbliche; offline non si lavora. Configurazione, icone, compatibilità e limiti: [docs/pwa.md](docs/pwa.md).
Per cambiare il logo: sostituire `apps/web/public/icons/logo.png` e lanciare `pnpm --filter @telaio/web icone`.

## Docker e deploy

Un solo `Dockerfile` (multi-stage) produce due immagini: `web` (Next.js standalone) e `worker`
(job BullMQ; con altri comandi anche migrazioni e creazione dell'admin). Girano senza privilegi e
senza dipendenze di sviluppo.

- **Sviluppo:** `docker-compose.yml` avvia Postgres, Redis e Mailpit; `docker compose --profile app up --build`
  prova anche le immagini di produzione in locale (web su 3000).
- **Produzione:** `docker-compose.prod.yml` (Postgres 18, Redis 7, migrazioni, web, worker), Nginx sull'host,
  immagini su GHCR con il commit SHA come tag e deploy via GitHub Actions. Salute dell'app su `/api/health`.
  Guida completa (DNS, VPS, secrets, primo deploy, backup, rollback, troubleshooting): [docs/deploy.md](docs/deploy.md).
- Le variabili di produzione sono in `.env.production.example`; il file vero sta solo sul VPS.
