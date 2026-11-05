# Dominio

## Convenzioni numeriche

- Importi: **interi in centesimi** (`integer`). Mai float.
- Aliquote e percentuali: **punti base** (`2200` = 22,00 %). Sconti e ritenute idem.
- Arrotondamento: al centesimo, **half away from zero**, solo su interi (`roundDiv`).

## Entità

- **ragioni_sociali** (emittenti): dati anagrafici, regole fiscali, formati di numerazione, conto predefinito.
- **conti**: per ragione sociale; tipo `bonifico` | `contante` | `carta`; saldo iniziale.
- **clienti_ref**: riferimento locale a una Company di Twenty.
- **listini** → **listino_basi** e **listino_moduli**; **modulo_basi** è la relazione molti-a-molti modulo↔base. Ogni voce ha `prezzo_una_tantum`, `canone_annuo`, `canone_mensile` (netti).
- **preventivi** → **preventivo_righe** (con `gruppo_alternativa_id` e `accettata`); **fatture** → **fattura_righe**. Entrambi con snapshot JSON di emittente, cliente e regole IVA.
- **abbonamenti** → **rate** (anche rate singole da preventivo); **incassi** su rata/fattura/libero; **movimenti** (prima nota); **solleciti**.
- **progetti** → **progetto_risorse**: commesse per i clienti (vedi «Progetti»); **progetti_numerazione** è il contatore annuale dei codici.
- Sistema: **api_keys**, **webhooks**, **webhook_deliveries**, **pending_actions**, **audit_log**, **numerazioni**.

## Regole fiscali (per ragione sociale)

| Campo                                     | Significato                                        |
| ----------------------------------------- | -------------------------------------------------- |
| `iva_attiva`                              | se falso: nessuna IVA, vale la dicitura            |
| `aliquota_iva_bp`                         | es. 2200                                           |
| `natura_senza_iva` + `dicitura_senza_iva` | es. `N2.2`, `N4`, con testo di legge               |
| `bollo_automatico`                        | solo senza IVA: € 2,00 se imponibile > € 77,47     |
| `ritenuta_bp`                             | ritenuta d'acconto sull'imponibile (opzionale)     |
| `split_payment`                           | IVA versata dal cliente PA direttamente all'erario |

Calcolo (`calcolaTotali`):

```
imponibile   = Σ righe (quantità × prezzo, meno sconto)
iva          = iva_attiva ? imponibile × aliquota : 0
bollo        = !iva_attiva && bollo_automatico && imponibile > 7747 ? 200 : 0
totale       = imponibile + iva + bollo
ritenuta     = imponibile × ritenuta_bp
netto_da_pagare = totale − ritenuta − (split_payment ? iva : 0)
```

Esempi su **€ 1.000,00** (100000 cent):

| Caso                     | Imponibile | IVA    | Bollo | Totale   | Ritenuta | Da pagare |
| ------------------------ | ---------- | ------ | ----- | -------- | -------- | --------- |
| IVA 22 %                 | 1.000,00   | 220,00 | –     | 1.220,00 | –        | 1.220,00  |
| IVA 22 % + split PA      | 1.000,00   | 220,00 | –     | 1.220,00 | –        | 1.000,00  |
| Senza IVA (N2.2), bollo  | 1.000,00   | –      | 2,00  | 1.002,00 | –        | 1.002,00  |
| Senza IVA, € 70,00       | 70,00      | –      | –     | 70,00    | –        | 70,00     |
| IVA 22 % + ritenuta 20 % | 1.000,00   | 220,00 | –     | 1.220,00 | 200,00   | 1.020,00  |

Regola di visualizzazione: con IVA attiva ogni prezzo si mostra **netto e lordo**; senza IVA un solo prezzo con la dicitura.

## Stati e transizioni

**Preventivo**: `bozza → inviato → (in_revisione ↔ inviato) → accettato | accettato_parzialmente | rifiutato`; `inviato`/`in_revisione → scaduto` alla data di validità; `scaduto → in_revisione` per riaprirlo. `accettato`, `accettato_parzialmente` e `rifiutato` sono finali. Vedi «Accettazione dei preventivi».

**Fattura**: `bozza → emessa → inviata_sdi → consegnata | scartata`; `emessa → pagata` / `parzialmente_pagata` in base agli incassi; `scartata → bozza` per correggere. Una fattura emessa non si modifica (si annulla con nota di credito, non gestita nella base).

**Rata**: `da_incassare → incassata` (o `parziale`); `da_incassare → scaduta` quando la scadenza passa; `scaduta → incassata`. `annullata` se l'abbonamento si chiude.

**Abbonamento**: `attivo ↔ sospeso → cessato`. Periodicità `mensile | trimestrale | semestrale | annuale`. Le rate si generano in anticipo su un orizzonte (default 12 mesi) in modo idempotente (chiave `abbonamento_id + scadenza`).

## Numerazioni

Per ragione sociale, tipo documento e anno, formato configurabile con `{AAAA}`, `{AA}`, `{N}`, `{NNN}` (zero-padding). Assegnazione atomica con `INSERT … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo`, nella stessa transazione del documento: niente buchi.

## Congelamento

All'emissione (`inviato` per i preventivi, `emessa` per le fatture) si salva `snapshot` = emittente + cliente + regole IVA + totali. Le modifiche successive alle impostazioni non toccano i documenti emessi.

**Modifica della bozza.** Finché il preventivo è in `bozza` si può riaprire nell'editor (`/preventivi/[id]/modifica`, tasto «Modifica» nel dettaglio) e cambiare tutto: emittente, cliente, oggetto, validità, righe, prezzi e alternative. Righe e totali si ricalcolano come alla creazione, lo snapshot si rinfresca (emittente, cliente, regole) e il preventivo resta lo stesso, senza numero. La validità conta dalla data di creazione. Dopo l'invio non si modifica più: il tasto sparisce e la pagina di modifica rimanda al dettaglio. Audit: `preventivo.modificato`. Le note, che l'editor non mostra, si conservano.

## Solleciti: sempre con conferma

Nessun sollecito parte da solo. Il worker (job `solleciti`, ogni mattina) **propone** una bozza per ogni rata scaduta e non incassata; l'invio avviene solo quando l'utente la rivede in Scadenzario, sceglie il destinatario e preme «Invia sollecito».

```
rata scaduta ──worker──► sollecito  da_confermare ──utente──► inviato   (email)
                                         │
                                         └──utente──► annullato
```

- Livelli 1–3 con tono crescente (promemoria → secondo sollecito → ultimo sollecito); dopo il terzo inviato non se ne propongono altri.
- Si propone un nuovo sollecito solo se non ce n'è uno in attesa e sono passati almeno 7 giorni dall'ultimo inviato.
- Il destinatario viene suggerito (prima persona con email su Twenty, altrimenti la PEC del cliente) ma l'utente può cambiarlo.
- L'invio è «prenotato» con un UPDATE condizionato su `stato = 'da_confermare'`: una doppia conferma non invia due email. Se l'SMTP fallisce la bozza torna in attesa.

## Incassi, prima nota e fatture

- Un **incasso** crea nella stessa transazione un movimento di prima nota (entrata) sul conto scelto, poi riallinea la rata (`parziale` / `incassata`) e la fattura (`parzialmente_pagata` / `pagata`) collegate. Può essere libero.
- **Saldo conto** = saldo iniziale + entrate − uscite − giroconti in uscita + giroconti in entrata.
- **Fattura da preventivo**: da un preventivo `accettato` o `accettato_parzialmente`, con le sole righe una tantum **accettate** (mai i canoni); una fattura per preventivo, garantita da un indice univoco parziale. Se non resta nessuna prestazione una tantum accettata non si crea una fattura vuota. All'**emissione** assegna il numero, congela emittente e regole del momento, ricalcola i totali e crea la rata (scadenza a 30 giorni) che compare nello scadenzario.
- **Date modificabili.** La data di un incasso si cambia quando si vuole (anche nel passato o nel futuro) e si sposta anche il movimento di prima nota; importo e conto no. La fattura si emette con la data scelta (il numero segue l'anno di quella data); dopo l'emissione si possono cambiare emissione e scadenza, ma l'emissione deve restare nell'anno del numero (la numerazione è progressiva per anno) e una fattura già passata dallo SDI non si tocca. La scadenza si riflette sulla rata dello scadenzario. Ogni modifica finisce nel registro delle operazioni (`incasso.data_modificata`, `fattura.date_modificate`).
- **Preventivo**: all'invio (bozza → inviato) assegna il numero e congela emittente, regole e totali.

## Progetti

Un progetto è una commessa per un cliente. Nasce **a mano** da Progetti → Nuovo progetto, oppure **da un preventivo accettato** con «Crea progetto» (mai in automatico: è una scelta dell'utente).

- **Codice**: `PRJ-AAAA-NNN`, progressivo per anno, assegnato nella stessa transazione del progetto (niente buchi) e non modificabile.
- **Cliente**: solo un riferimento a `clienti_ref` (l'anagrafica resta su Twenty). Da preventivo il progetto eredita il cliente del preventivo; l'opportunità Twenty si legge dal preventivo (`twenty_opportunity_id`), non si duplica.
- **Preventivo di origine**: opzionale, e un preventivo può generare **più progetti** (due lavori nello stesso preventivo): `preventivo_id` ha un indice normale, non univoco. Si collega solo un preventivo `accettato` o `accettato_parzialmente` che abbia **almeno una prestazione accettata** (`accettata = true`, una tantum o abbonamento): le righe escluse non contano, e il progetto non copia né modifica le righe del preventivo, di cui tiene solo il riferimento. «Crea progetto» compare nelle stesse condizioni. La creazione da preventivo è una transazione che blocca la riga del preventivo; non è idempotente per scelta, e contro il doppio clic accidentale il pulsante resta disattivato durante l'invio. La pagina del preventivo elenca i progetti collegati e, finché ci sono prestazioni accettate, propone ancora «Crea progetto».
- **Categorie**: `software`, `sito_web`, `ecommerce`, `infrastruttura`, `consulenza`, `altro` (elenco fisso, nessun editor).
- **Stati**: `pianificato`, `in_corso`, `in_attesa`, `completato`, `annullato`; si passa liberamente da uno all'altro. **Priorità**: `bassa`, `normale`, `alta`, `urgente`.
- **Date effettive** automatiche: il primo passaggio a `in_corso` (o direttamente a `completato`) fissa l'inizio; `completato` fissa la fine; riaprire un progetto completato cancella la fine. Le date già presenti non si sovrascrivono.
- **Risorse** (`progetto_risorse`): collegamenti esterni (repository, design, produzione, staging, documentazione, infrastruttura, monitoraggio, altro), con ambiente opzionale (`development`, `staging`, `production`) e al più un collegamento principale per progetto (indice univoco parziale). Solo URL `http`/`https`, senza nome utente e password nell'indirizzo. Si eliminano davvero (nessun soft delete: sono semplici collegamenti, l'audit conserva chi li ha tolti). Ogni modifica aggiorna `updated_at` del progetto.
- **Audit**: `progetto.creato`, `progetto.modificato`, `progetto.stato`, `progetto.creato_da_preventivo`, `progetto_risorsa.creata`, `progetto_risorsa.modificata`, `progetto_risorsa.eliminata`.
- Pensato per crescere: stato del progetto separato dallo stato dei ticket, risorse in una tabella a parte, nessun JSONB al posto delle entità e nessuna dipendenza dalla fatturazione. Fuori da questa fase: campi personalizzati, tipologie configurabili, task e sotto-attività, time tracking, automazioni.

### Ticket e lavagna kanban

Ogni progetto ha una **lavagna** (`/progetti/[id]/ticket`) e un dettaglio per ogni ticket (`/progetti/[id]/ticket/[numero]`).

- **Elenco generale** (`/ticket`, voce «Ticket» nella barra laterale, scorciatoia `G` poi `T`): tutti i ticket di tutti i progetti in una tabella con ricerca e filtri per progetto, stato, tipo e priorità; gli aperti stanno prima dei completati. Si apre il dettaglio con un clic; i ticket si creano dalla lavagna del progetto.
- **Ticket** (`ticket`): titolo, descrizione, **tipo** (`attivita`, `bug`, `richiesta`, `assistenza`), **stato**, **priorità** (stessa scala dei progetti), assegnatario, segnalatore (chi lo crea), scadenza. Il **numero** è progressivo per progetto (`progetti.ultimo_ticket`, incrementato nella transazione che crea il ticket: niente buchi né duplicati con richieste in parallelo); il codice mostrato è quello del progetto più il numero (`PRJ-2026-001-7`).
- **Stato = colonna**: `backlog`, `da_fare`, `in_corso`, `in_revisione`, `completato`; si passa liberamente dall'una all'altra e lo stato del ticket **non** influenza lo stato del progetto, né viceversa. Entrare in `completato` registra `completato_at`, uscirne lo toglie.
- **Ordine nella colonna**: `posizione` è un numero reale; un ticket inserito tra due vicini prende la media delle loro posizioni, senza riscrivere gli altri. Se tra due vicini non c'è più spazio, la colonna si rinumera a passi di 1000 (regola pura in `@telaio/core`, `posizioneTra`). Un ticket nuovo o che cambia stato dalla modale va in fondo alla colonna.
- **Lavagna**: trascinamento delle schede tra colonne e dentro la stessa colonna (HTML5, nessuna libreria nuova); sul telefono dove il trascinamento non c'è, il menu «Sposta» di ogni scheda. Creazione rapida dal fondo di ogni colonna (solo il titolo) o dalla modale completa; filtri per testo, assegnatario («assegnati a me», «non assegnati») e priorità. Lo spostamento è ottimistico: se il server lo rifiuta la lavagna torna com'era e compare l'errore.
- **Assegnazione automatica** (Impostazioni → Ticket, spenta di default, chiave `ticket` in `impostazioni`): con l'interruttore acceso i ticket creati dalla lavagna con il solo titolo vanno a chi li crea, e nella finestra di creazione completa «Assegnato a» parte già da lui (si può cambiare o lasciare vuoto).
- **Commenti** (`ticket_commenti`): in ordine di scrittura, eliminabili.
- **Eliminazione**: soft delete (`deleted_at`): il ticket esce dalla lavagna e resta per lo storico.
- **Audit**: `ticket.creato`, `ticket.modificato`, `ticket.stato`, `ticket.eliminato`, `ticket.commento`, `ticket.commento_eliminato`. I ticket compaiono anche nella ricerca ⌘K.

### Documenti del progetto (archivio S3)

I file non stanno nel database: vanno in un **bucket S3 o compatibile** (Amazon S3, MinIO, Cloudflare R2, Backblaze…). Nel database (`progetto_documenti`) restano nome, dimensione, tipo, categoria (`contratto`, `specifiche`, `design`, `consegna`, `altro`), descrizione, chi l'ha caricato e la **chiave** dell'oggetto, `[cartella/]progetti/<progetto>/<documento>/<nome>`. Un documento può essere allegato a un ticket del **stesso** progetto.

- **Configurazione** in Impostazioni → Archiviazione: indirizzo del servizio (vuoto per Amazon S3), regione, bucket, cartella, path-style, access key e secret key. Il bucket e le chiavi non sono nel codice. Le **chiavi si salvano cifrate** (AES-256-GCM, chiave ricavata da `BETTER_AUTH_SECRET`) e non tornano mai al browser: la pagina mostra solo l'access key ID. Se il segreto dell'app cambia le chiavi salvate non si leggono più e vanno reinserite. In assenza di impostazioni valgono le variabili `S3_*` (ripiego), e senza chiavi il client usa la catena predefinita di AWS (ruolo IAM). «Prova la connessione» scrive, legge ed elimina un oggetto di prova; «Crea il bucket» lo crea se manca.
- **Caricamento**: passa dal server (`POST /api/progetti/[id]/documenti`), fino a 25 MB per file e 10 file per richiesta; un file sbagliato non blocca gli altri. Se la registrazione nel database fallisce, l'oggetto appena scritto viene tolto dal bucket.
- **Download**: sempre attraverso il server (`GET /api/documenti/[id]`), con la sessione: il bucket non è mai esposto e non servono URL pubblici. Sempre come allegato (`Content-Disposition: attachment`, `nosniff`, CSP `sandbox`); solo PDF e immagini raster hanno l'anteprima nel browser (`?anteprima=1`). Niente HTML o SVG renderizzati dall'app.
- **Eliminazione**: il documento sparisce dal progetto (`deleted_at`) e l'oggetto dal bucket; se il bucket non risponde, il file resta nel bucket ma l'app non lo raggiunge più.
- **Audit**: `documento.caricato`, `documento.eliminato`, `archivio.configurato`, `archivio.bucket_creato`.
- **Backup**: il backup del database **non** contiene i file. Quelli vanno protetti dal provider del bucket (versioning, replica).

## Accettazione dei preventivi

Il preventivo ha due macrosezioni, mostrate separate in editor, dettaglio, PDF e tabella:

- **Prestazioni una tantum** (`tipo = una_tantum`): pagamento non ricorrente. Sono le uniche che entrano nei totali (imponibile, IVA, bollo, ritenuta, split) e nella fattura.
- **Abbonamenti** (`canone_mensile`, `canone_annuo`): servizi ricorrenti, ognuno con l'importo **per periodo**. Non si sommano tra loro né ai totali; l'unico aggregato è un valore ricorrente annualizzato **indicativo** (mensile × 12), mai fatturabile.

### Alternative annuale/mensile

Due righe con lo stesso `gruppo_alternativa_id` sono **alternative dello stesso servizio**: un canone annuo e uno mensile, mai una tantum, sempre due righe. Il cliente ne sceglie una sola. Una voce di listino con entrambi i canoni genera un gruppo da sola; nell'editor si possono raggruppare a mano due abbonamenti con periodicità diversa («Alternativa a»). I servizi diversi coesistono.

### Decisioni sulle righe

`preventivo_righe.accettata`: `null` = nessuna decisione; `true` = accettata; `false` = esclusa o alternativa non scelta. Alla chiusura ogni riga ha una decisione, e le righe escluse **non si cancellano** né cambiano importo: restano nel dettaglio (barrate, in rosso) e nel PDF.

L'unità di decisione è il **servizio**: una riga indipendente oppure un intero gruppo. Esito (`valutaAccettazione`, in `@telaio/core`):

| Esito                    | Quando                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `accettato`              | tutti i servizi sono accettati (per un gruppo basta una modalità scelta: l'alternativa non scelta non è un'esclusione) |
| `accettato_parzialmente` | almeno un servizio accettato e almeno uno escluso (una prestazione tolta, o un intero gruppo rifiutato)                |
| `rifiutato`              | nessun servizio accettato: si chiude con «Rifiuta il preventivo», non con l'accettazione                               |

Il server riconvalida tutto: righe estranee al preventivo, un gruppo senza scelta esplicita, due alternative dello stesso gruppo o un'alternativa fuori dal suo gruppo sono errori e non cambiano nulla.

### Totali e storico

L'offerta originale (`imponibile_cent`, `iva_cent`, `bollo_cent`, `totale_cent`) **non cambia mai**. L'accettazione scrive a parte `imponibile_accettato_cent`, `iva_accettata_cent`, `bollo_accettato_cent`, `totale_accettato_cent` e `data_accettazione`, ricalcolati con `calcolaTotali` sulle sole una tantum accettate e con le regole fiscali congelate all'invio: il bollo si ricalcola perché la soglia può cambiare. Sono nulli prima dell'accettazione. Un preventivo chiuso non si modifica in silenzio.

### Accettazione transazionale (`accettaPreventivo`)

Una sola transazione, con il preventivo bloccato (`FOR UPDATE`): verifica lo stato (solo `inviato`/`in_revisione`), valuta la scelta, crea gli abbonamenti, scrive le decisioni sulle righe e i totali accettati. La seconda di due richieste concorrenti trova il preventivo già chiuso e fallisce senza duplicare nulla. Servono un cliente e una data di decorrenza (di norma oggi, mai nel passato) solo se si accettano canoni.

### Abbonamenti dai canoni accettati

Per ogni riga ricorrente accettata nasce un record `abbonamenti` con `preventivo_riga_id` **univoco** (una riga, al più un abbonamento) e `preventivo_id`; gli abbonamenti creati a mano non hanno la riga. `canone_mensile` → `mensile`, `canone_annuo` → `annuale`; l'importo della rata è l'importo della riga per periodo (quantità e sconto compresi), non annualizzato. `inizio` è la decorrenza scelta. Le rate si generano subito dopo la transazione con il meccanismo esistente (`generaRateAbbonamenti`, idempotente per abbonamento e scadenza); non si creano fatture per le rate. **Recupero**: se la generazione fallisce, l'accettazione resta valida e il job giornaliero completa le rate; `completaAbbonamentiPreventivo` ricrea gli abbonamenti mancanti e le rate, ed è l'unico modo (volontario, manuale) di coprire preventivi accettati prima di questa funzione: la migrazione non crea abbonamenti storici.

### Fattura dalle prestazioni accettate

`creaFatturaDaPreventivo` accetta `accettato` e `accettato_parzialmente`, prende le righe `una_tantum` con `accettata = true` (descrizioni, quantità, prezzi e sconti originali), ricalcola i totali con le regole congelate e lascia fuori righe escluse, canoni e alternative non scelte.

### Preventivi storici

La migrazione `0006` tratta i preventivi già `accettato` come accettati per intero: le loro righe risultano `accettata = true` e i totali accettati coincidono con l'offerta (data di accettazione = ultimo aggiornamento). I preventivi non ancora accettati restano con `accettata = null`. Per i preventivi storici con un canone annuo e uno mensile della stessa voce, entrambe le righe risultano accettate, com'era prima: vanno riviste a mano. Le fatture già generate non cambiano.
