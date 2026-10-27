# Architettura

Telaio è un monorepo **pnpm + Turborepo**. Un solo database PostgreSQL, Redis per le code.

```
telaio/
├── apps/
│   ├── web/        Next.js (App Router): UI, Server Actions, /api/v1, /mcp
│   └── worker/     processo Node con BullMQ: rate, solleciti, sync Twenty, webhook, backup
├── packages/
│   ├── core/       logica di dominio pura (IVA, bollo, ritenuta, split, totali, rate, numerazioni)
│   ├── db/         schema Drizzle, migrazioni, seed, client `postgres`
│   └── twenty/     client tipizzato (Zod) per Twenty CRM
├── docs/           questa documentazione
└── docker-compose.yml  Postgres, Redis, Mailpit (sviluppo)
```

## Responsabilità

| Pacchetto | Fa                                                                                                       | Non fa                                             |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `core`    | Funzioni pure su interi (centesimi, punti base). Nessun I/O.                                             | Non conosce DB, Next, Zod dei form.                |
| `db`      | Tabelle, relazioni, migrazioni, seed, assegnazione atomica dei numeri.                                   | Non contiene regole fiscali (le chiama da `core`). |
| `twenty`  | Legge Company/People/Opportunity; scrive fase opportunità e allegati. Dati finti senza `TWENTY_API_URL`. | Non scrive su Postgres.                            |
| `web`     | Auth, layout, pagine, Server Actions, API REST, server MCP, palette ⌘K.                                  | Non esegue job lunghi: li accoda.                  |
| `worker`  | Esegue i job BullMQ, schedulati con job repeatable.                                                      | Non serve HTTP.                                    |

Dipendenze ammesse: `web` e `worker` → `db`, `core`, `twenty`. `core` non dipende da nessuno.

## Flusso dei dati con Twenty

```
Twenty (fonte di verità)
   │  REST  (lettura Company, People, Opportunity)
   ▼
packages/twenty ──► web (liste/dettaglio clienti, ricerca)
   │                 │ salva riferimento al momento dell'uso
   │                 ▼
   │            clienti_ref  (twenty_company_id, nome, P.IVA, CF, PEC, SDI, flag PA, synced_at)
   │
   └── worker: job `sync-twenty` aggiorna i clienti_ref esistenti
   ◄── scritture ammesse: fase dell'opportunità e allegati PDF nella timeline
```

In locale si tiene **solo il riferimento**; ogni documento emesso congela una copia dei dati del cliente.

## Richieste e processi

- **Mutazioni dei form**: Server Actions con schema Zod; i form si aprono in modale.
- **API REST** `/api/v1`: chiave API (hash SHA-256), permessi `lettura` / `lettura_scrittura`, rate limit per chiave in Redis.
- **MCP** `/mcp` (Streamable HTTP): token personale (una API key con scope MCP). Gli strumenti di scrittura non toccano le tabelle di dominio: creano una `pending_action` che l'admin conferma in `/azioni-in-attesa`.
- **Webhook in uscita**: gli eventi di dominio creano righe in `webhook_deliveries`; il worker le consegna con firma HMAC e ritenta con backoff.
