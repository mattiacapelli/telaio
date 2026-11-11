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
├── Dockerfile          un'immagine per web, worker e migrazioni (cambia il comando)
└── docker-compose.yml  Postgres, Redis, Mailpit, MinIO; profilo "app": migrate, web, worker
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
- **MCP** `/mcp` (Streamable HTTP): token personale (una API key con scope MCP). Per ogni strumento l'admin decide (Impostazioni → MCP) se aspetta la sua approvazione: in quel caso la chiamata crea una `pending_action` che si conferma in `/azioni-in-attesa` e l'assistente legge l'esito con `stato_azione`. Predefinito: le scritture chiedono conferma, le letture no.

  **Copertura (circa 105 strumenti, in Impostazioni → MCP per area).** Ogni entità dell'app ha il suo CRUD: ragioni sociali e regole fiscali, conti, listini con basi e moduli, preventivi (anche l'accettazione parziale), fatture, incassi, prima nota, abbonamenti, rate, progetti con risorse, ticket con commenti, allegati (file e link su progetti, ticket, preventivi e clienti; carico e scarico in base64 fino a 10 MB; file già in archivio riallegabili) e le impostazioni di email e ticket; in più la lettura del registro delle operazioni. Le convenzioni: `elenca_*`, `dettaglio_*`, `crea_*`, `modifica_*` (campi non indicati = invariati, `null` = svuota), `elimina_*`. Dove l'app non cancella davvero lo strumento fa lo stesso: archivia (ragioni sociali, conti, listini, voci), usa lo stato («annullato» per i progetti) o elimina in modo logico (ticket, documenti, incassi, movimenti, abbonamenti). Le bozze si modificano ed eliminano, i documenti emessi no.
  **Fuori dall'MCP per scelta:** clienti e opportunità (la fonte di verità è Twenty, resta solo la lettura e il cambio di fase), chiavi API, webhook, impostazioni degli strumenti MCP e conferma/rifiuto delle azioni in attesa (sono il controllo di sicurezza stesso: un assistente non può darsi i permessi), credenziali SMTP e chiavi del bucket S3, utenti e accesso.
- **Webhook in uscita**: gli eventi di dominio creano righe in `webhook_deliveries`; il worker le consegna con firma HMAC e ritenta con backoff.
