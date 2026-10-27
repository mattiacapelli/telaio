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
- Navigazione: Dashboard raggiunta dal logo/saluto; Commerciale 01–05 include «Azioni in attesa» — così Incassi è 07 come nell'esempio del prompt.
- Totale di un preventivo = solo le righe una tantum; i canoni annui/mensili restano righe a parte e si sommano per tipo — mescolarli in un unico imponibile non avrebbe senso fiscale.
- Tabella `impostazioni` (chiave/valore) extra — serve per attivare/disattivare gli strumenti MCP.
- `proxy.ts` (Next 16, ex middleware) fa solo un controllo ottimistico del cookie; l'autorizzazione vera è `requireSession()` in ogni pagina e Server Action.
- `/api/v1` e `/mcp` sono esclusi dal proxy: usano chiavi API (Bearer, hash SHA-256, prefisso `tlk_`), non la sessione.
- Conferma di una `pending_action` con UPDATE condizionato su `stato = 'in_attesa'` — una doppia conferma non esegue due volte.
- Form in modale: `FormModal` con `useActionState`; gli errori per campo arrivano ai `Field` tramite context, così i campi possono restare Server Component.
- Il `.env` sta nella radice: `next.config.ts` lo carica con `process.loadEnvFile`, gli script di db e worker con `--env-file`.
- Importi formattati con separatore delle migliaia sempre attivo (`useGrouping: "always"`): `Intl` per `it-IT` lo omette sui numeri a 4 cifre.
- Colore `--grey-1` (#969184) solo per bordi e decorazioni: sul fondo carta non raggiunge il contrasto AA per il testo, che usa `--muted`.
