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

Accesso: l'utente creato dal seed (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, di default `mattia@telaio.local` / `telaio-dev-2026`). Mailpit: http://localhost:8025.

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

| Variabile                                                    | Uso                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                               | connessione PostgreSQL                                                 |
| `REDIS_URL`                                                  | code BullMQ e rate limit delle API                                     |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                      | segreto e URL pubblico per l'autenticazione (anche rpID delle passkey) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | utente creato dal seed                                                 |
| `TWENTY_API_URL`, `TWENTY_API_KEY`                           | Twenty CRM; se vuoti `/clienti` usa dati finti                         |
| `SMTP_HOST`, `SMTP_PORT`                                     | email (Mailpit in sviluppo; non ancora usate)                          |

## Struttura

```
apps/web        Next.js: UI, Server Actions, /api/v1, /mcp
apps/worker     BullMQ: genera-rate (attivo), solleciti, sync-twenty, webhook, backup (stub)
packages/core   logica di dominio pura: IVA, bollo, ritenuta, split, rate, numerazioni
packages/db     schema Drizzle, migrazioni, seed
packages/twenty client REST tipizzato per Twenty
docs/           architettura, dominio, decisioni
```

## MCP e API

1. In **Impostazioni → API e webhook** crea una chiave (ambito `mcp` e/o `api`); la chiave si vede una sola volta.
2. Server MCP: `POST /mcp` con `Authorization: Bearer tlk_…`. Strumenti attivi: `cerca_clienti`, `elenca_preventivi`, `listino`, `crea_preventivo`; gli altri sono dichiarati ma non implementati.
3. Le scritture di un'AI **non** vanno nel DB: `crea_preventivo` crea una riga in `pending_actions` che confermi in **Azioni in attesa**.
4. API REST: `/api/v1/preventivi`, `/api/v1/clienti`; documento OpenAPI su `/api/v1/openapi`.
