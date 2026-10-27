# Decisioni

Una riga ciascuna: scelta — perché.

- Monorepo pnpm + Turborepo — come da specifica; cache dei task e un solo lockfile.
- Importi `integer` in centesimi — niente float; `integer` (±21 M€) basta per un freelance, `bigint` complicherebbe i tipi in JS.
- Aliquote in punti base (`integer`) — precisione fissa senza decimali, confrontabili e serializzabili.
- Regole fiscali come colonne di `ragioni_sociali` — una sola ragione sociale = un solo set di regole; una tabella separata sarebbe 1:1 senza vantaggi.
- Bollo sull'imponibile > € 77,47 e incluso nel totale — è addebitato al cliente.
- Ritenuta calcolata sull'intero imponibile — caso più comune; la base percentuale si aggiunge dopo se serve.
- Client Twenty via **REST** — i dati sono semplici record; evita un client GraphQL e la generazione di tipi, e Zod valida le risposte.
- **Biome** al posto di ESLint+Prettier — un solo strumento, configurazione minima, molto più veloce.
- TypeScript 5.9 e non 7 — la versione nativa non è ancora supportata da tutto l'ecosistema (Next, Drizzle).
- Better Auth con adapter Drizzle e nomi tabella `users`/`sessions` — come da specifica; passkey e 2FA via plugin ufficiali.
- Token MCP = API key con scope `mcp` — un solo meccanismo di credenziali invece di un server OAuth completo; OAuth 2.1 resta un passo successivo.
- Rate limit per chiave in Redis (finestra fissa) — Redis c'è già per BullMQ.
- OpenAPI generato dagli schemi Zod con `z.toJSONSchema` (Zod 4) — nessuna libreria aggiuntiva.
- Tabella `numerazioni` extra rispetto all'elenco minimo — serve all'assegnazione atomica dei numeri.
- Nessuna libreria per le date — `Date.UTC` su stringhe `YYYY-MM-DD` basta per la generazione rate.
- Docker: solo Postgres, Redis, Mailpit — il prompt era troncato alla lista delle immagini; ho usato quelle di `~/Sviluppo/CLAUDE.md` necessarie ora. MinIO si aggiunge quando serve lo storage dei PDF.
- Un solo Dockerfile per web e worker (in seguito) — convenzione di `~/Sviluppo/CLAUDE.md`.
