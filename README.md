# Telaio

Gestionale per studio professionale: clienti, preventivi, progetti, attività,
ticket di assistenza, timesheet, fatture e incassi — con sincronizzazione
dell'anagrafica da **Twenty CRM**.

Next.js (App Router) · PostgreSQL via Prisma · Redis · Docker.

## Avvio rapido

```bash
cp .env.example .env      # se non l'hai già
npm install
npm run db:up             # postgres + redis in Docker
npx prisma migrate dev    # crea lo schema
npm run db:seed           # dati di esempio (Studio Ferrero)
npm run dev               # http://localhost:3000
```

## Tutto in container

L'app ha un suo `Dockerfile` (build multi-stage, output `standalone`) e sta nel
profilo compose `app`, così `docker compose up` da solo tira su i soli database.

```bash
./scripts/container.sh up      # postgres + redis + app, con build
./scripts/container.sh logs    # segue i log dell'app
./scripts/container.sh down    # ferma tutto, i dati restano
./scripts/container.sh reset   # ferma tutto e cancella i volumi (chiede conferma)
./scripts/container.sh dev     # solo i database, per lavorare con `npm run dev`
```

All'avvio il container applica le migrazioni (`prisma migrate deploy`) e, se il
database è vuoto, esegue il seed. Entrambe le operazioni sono idempotenti, quindi
il container si può riavviare senza effetti collaterali. Per saltare il seed:
`TELAIO_SEED=false`.

### Porte

Postgres e Redis sono esposti su **5433** e **6380** invece delle porte standard,
per non entrare in conflitto con altri progetti già in esecuzione sulla macchina.
Dentro la rete Docker restano invece le porte canoniche (5432 / 6379).

| Servizio | Host  | Container |
|----------|-------|-----------|
| app      | 3000  | 3000      |
| postgres | 5433  | 5432      |
| redis    | 6380  | 6379      |

## Accesso

Tutta l'app è protetta: senza sessione si finisce sul login. **Non c'è
registrazione aperta** — gli account si creano da riga di comando:

```bash
node scripts/utente.mjs crea marco@studioferrero.it "Marco Ferrero"
# senza password ne genera una casuale e la stampa una sola volta

npm run utenti                                    # elenco
node scripts/utente.mjs password <email> <nuova>  # cambia password
node scripts/utente.mjs disattiva <email>         # blocca l'accesso
node scripts/utente.mjs attiva <email>
```

Le password sono hashate con **scrypt** (nel core di Node, nessuna dipendenza
nativa da compilare) e sale casuale per utente; il confronto è a tempo costante.

Le sessioni vivono in **Redis**, non in un JWT, così si possono revocare
davvero. Cookie `httpOnly` + `sameSite=lax`, `secure` in produzione, durata 7
giorni prolungata a ogni richiesta. Disattivare un utente o cambiargli la
password **chiude subito le sue sessioni aperte**, senza aspettarne la scadenza.

Il middleware verifica solo la presenza del cookie (gira su runtime edge, dove
Redis non è raggiungibile); la validità effettiva è controllata dal layout
server. Le rotte `/api/*` rispondono `401` in JSON invece di redirigere.

## Kanban e tabella

Preventivi, Progetti, Attività, Ticket e Fatture hanno entrambe le viste, con
un selettore in alto a sinistra. La preferenza è **per pagina** e vive in
`localStorage`: lavorare in tabella sui preventivi non cambia la vista dei
ticket.

Il trascinamento resta disponibile solo in kanban; la tabella è pensata per
leggere e confrontare, e ordina per stato seguendo l'ordine delle colonne.

Le celle sono passate già renderizzate (`RigaTabella.celle`), non come
funzioni: un server component non può passare callback a un client component.

## Kanban interattive

Preventivi, Progetti, Attività, Ticket e Fatture sono board trascinabili:
spostare una card cambia davvero lo stato su Postgres. L'aggiornamento è
ottimistico — la card si muove subito e, se il salvataggio fallisce, torna
indietro con un messaggio d'errore.

Alcuni passaggi hanno effetti collaterali voluti: un preventivo spostato in
"Inviato" registra la data di invio, un'attività in "Fatta" la data di
completamento, un ticket risolto la data di chiusura.

Ogni card ha anche un menu "⋯ → Sposta in", perché il trascinamento da solo
non è utilizzabile da tastiera.

## Creare documenti

**Preventivi** — "Nuovo preventivo" apre un form con voci multiple. Il numero
(`PRE-2026/023`) è assegnato al salvataggio con progressivo annuale, e
l'imponibile è calcolato dal server sommando le voci: non viene accettato dal
client, così non può divergere dal dettaglio.

### Revisioni

Finché è in **bozza**, un preventivo si modifica liberamente: non è ancora
uscito dallo studio. Una volta **inviato**, ogni modifica congela la versione
attuale come revisione (`r2`, `r3`…) prima di sovrascrivere — così la versione
che il cliente ha ricevuto resta consultabile.

Le revisioni sono immutabili: le voci sono copiate per valore, non
referenziate. Un **preventivo accettato non è modificabile**, perché da lì
nasce il progetto.

Il campo *motivo* descrive la modifica che ha prodotto una versione, non quella
che l'ha sostituita: leggendo lo storico, ogni riga spiega perché quella
versione esiste.

**Fatture** — due strade:

- *Nuova fattura*: righe compilate a mano. Se non indichi la scadenza, viene
  calcolata dai termini di pagamento del cliente.
- *Genera da ore*: raggruppa le ore fatturabili non ancora fatturate per
  cliente e propone un importo, applicando la tariffa del cliente. Genera una
  riga per progetto, più una "Assistenza e interventi" per le ore su ticket.

Le ore fatturate restano collegate alla riga di fattura (`rigaFatturaId`):
è questo legame a impedire che finiscano due volte in fattura. La generazione
avviene in transazione, così la fattura e il collegamento valgono insieme.

## Design system

La palette e le misure sono prese dal design system di Twenty
([twentyhq/twenty](https://github.com/twentyhq/twenty), `packages/twenty-ui/src/theme/constants`),
non stimate a occhio:

| Cosa | Origine |
|---|---|
| Scala di grigi | `GRAY_SCALE_DARK` / `GRAY_SCALE_LIGHT` |
| Superfici, bordi, testo | `BACKGROUND_*`, `BORDER_*`, `FONT_*` |
| Blu primario | `MAIN_COLORS.blue` = Radix `indigo9` |
| Sfondi hover/attivo | `GRAY_SCALE_*_ALPHA` |
| Radice | `html { font-size: 13px }` — **non** i 16px del browser |
| Font | Inter; corpo `md` 1rem = 13px |
| Icone sidebar | `TintedIconTile`: tile 20px con bordo, icona 14px |
| Tinte dei tile | `TINTED_ICON_TILE_COLOR_SHADES`: sfondo = tinta 5, bordo = 6, icona = 11 |
| Raggi | `BORDER_COMMON.radius` (sm 4px, md 8px) |
| Spaziature | `spacingMultiplicator` 4px |
| Bottoni | `Button.module.scss`: 32px / 24px, padding 8px |
| Voci di menu | `NavigationDrawerItem`: altezza 28px, raggio 8px |
| Icone | `TEXT.iconSizeMedium` 16px, stroke 1.6 |

**La radice a 13px non è un dettaglio**: Twenty imposta `html { font-size: 13px }`
in `twenty-front/src/index.css`, quindi tutti i loro token in rem sono tarati su
quella base. Con i 16px predefiniti del browser ogni misura risulta circa il 23%
più grande. Per lo stesso motivo le altezze prese dal loro codice (28px per una
voce di menu, 32px per un bottone) sono scritte in px assoluti, non in utility
Tailwind che si ridimensionerebbero con il rem.

I colori originali sono in `display-p3`. Sono dichiarati così dentro un
`@supports`, con fallback esadecimale in sRGB per i browser che non lo
supportano.

**Attenzione se tocchi l'accento**: `ACCENT.primary` è `blue5`, un blu scuro da
sfondo. Il bottone primario usa invece `--t-color-blue` (`indigo9`), come si
vede in `Button.module.scss`.

## PDF dei preventivi

`GET /api/preventivi/[id]/pdf` genera il documento **al momento della
richiesta**, leggendo dal database: non esiste un file archiviato che possa
divergere dal preventivo dopo una modifica.

`?revisione=2` ristampa una versione congelata invece di quella corrente, così
il documento che il cliente ha ricevuto resta riproducibile anche dopo
revisioni successive. Il pulsante PDF è sulla scheda del preventivo, e ogni
riga dello storico ha il suo.

## Documenti dei progetti

Si allegano file a **progetti, ticket e contratti**: stessa tabella `Documento`
con riferimenti opzionali, così il componente di caricamento è condiviso.

I file stanno su **MinIO** (S3-compatibile), con i soli
metadati a database. Il download passa da un URL firmato che scade dopo 5
minuti: conoscere il percorso non basta per accedere al file.

Console MinIO su `http://localhost:9003` (utente e password da `.env`).
Il bucket viene creato al primo caricamento. Limite per file: 25 MB.

## Workflow

Automazioni configurabili trascinando blocchi su una tela (`/workflow`).

Un workflow ha un **innesco** (un evento di Telaio, una cadenza fissa, o
l'avvio manuale), **condizioni** che devono essere tutte vere, e **azioni**
eseguite in ordine. Se una condizione non è soddisfatta il workflow si ferma
senza errore: non è un fallimento, semplicemente non era il caso di agire.

Azioni disponibili: creare progetti e attività, scrivere nel diario, creare
notifiche interne, inviare email (SMTP facoltativo) e chiamare webhook.

Nei testi si possono usare segnaposto come `{numero}`, `{cliente}`,
`{imponibile}`, sostituiti con i valori dell'entità che ha fatto scattare
l'automazione.

Ogni esecuzione lascia una riga nel registro con il suo esito, così si capisce
perché un workflow non ha fatto quello che ci si aspettava. Un'automazione che
fallisce non fa mai fallire l'operazione che l'ha innescata.

## Contratti

Tre tipi, stessa tabella perché condividono il ciclo di vita (date, rinnovo,
canone) e differiscono solo per come si consumano:

- **Assistenza a ore** — monte ore per periodo (es. 20 h/mese a 900 €). I
  ticket del cliente lo consumano; le ore oltre il monte restano fatturabili
  alla tariffa extra.
- **Canone fisso** — importo ricorrente senza monte ore.
- **Contratto di progetto** — collegato a un progetto.

Il monte ore si misura **per periodo**, non sulla vita del contratto: 20 h/mese
significa 20 ore ogni mese. I confini del periodo sono ancorati alla data di
stipula, non al mese solare.

Attivando un contratto di assistenza, i ticket aperti del cliente non ancora
coperti gli vengono collegati automaticamente.

`POST /api/contratti/[id]/fattura` genera la fattura del canone per il periodo
corrente, con una riga separata per l'eventuale eccedenza. Un periodo si
fattura una volta sola: il legame `PeriodoContratto.fatturaId` impedisce il
doppio addebito.

## Twenty CRM

L'anagrafica clienti è **di sola lettura**: la fonte di verità è Twenty. Per
attivare la sincronizzazione, in `.env`:

```
TWENTY_API_URL="https://api.twenty.com"   # o l'URL della tua istanza
TWENTY_API_KEY="..."                      # Impostazioni › API & Webhooks
```

Poi il pulsante **Sincronizza ora** in *Clienti* o *Impostazioni*, oppure:

```bash
curl -X POST http://localhost:3000/api/sync
```

Il sync fa upsert su `twentyId`: rieseguirlo non duplica nulla. I campi mappati
sono quelli del workspace reale, inclusi i custom italiani `piva`,
`codiceFiscale`, `pec`, `codiceSdi`, `settore`, `statoRelazione`. I dati
operativi (tariffa oraria, progetti, ore) restano di Telaio e non vengono
sovrascritti dalle sincronizzazioni successive.

## Ruolo di Redis

- **Cache di lettura** con TTL di 30s sulle query di elenco, invalidata dopo il sync.
- **Timer di lavoro**: lo stato vive in Redis, non in memoria del processo, così
  sopravvive ai reload di Next e resta coerente fra più istanze dell'app. Allo
  stop, se sono passati almeno 60 secondi, viene creata una registrazione ore.

Se Redis non è raggiungibile l'app continua a funzionare leggendo da Postgres.

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run db:up` / `db:down` | database in Docker |
| `npm run db:migrate` | crea/applica una migrazione |
| `npm run db:seed` | popola con i dati di esempio |
| `npm run db:reset` | ricrea da zero e ripopola |
| `npm run db:studio` | Prisma Studio |

## Struttura

```
app/           una cartella per schermata + /api (timer, sync)
components/    sidebar, topbar, primitive UI condivise
lib/           prisma, redis, twenty, query, formattazione
prisma/        schema, migrazioni, seed
docker/        entrypoint del container
scripts/       container.sh
```
