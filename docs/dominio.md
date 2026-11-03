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
- **preventivi** → **preventivo_righe**; **fatture** → **fattura_righe**. Entrambi con snapshot JSON di emittente, cliente e regole IVA.
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

**Preventivo**: `bozza → inviato → (in_revisione ↔ inviato) → accettato | rifiutato`; `inviato`/`in_revisione → scaduto` alla data di validità; `scaduto → in_revisione` per riaprirlo. `accettato` e `rifiutato` sono finali.

**Fattura**: `bozza → emessa → inviata_sdi → consegnata | scartata`; `emessa → pagata` / `parzialmente_pagata` in base agli incassi; `scartata → bozza` per correggere. Una fattura emessa non si modifica (si annulla con nota di credito, non gestita nella base).

**Rata**: `da_incassare → incassata` (o `parziale`); `da_incassare → scaduta` quando la scadenza passa; `scaduta → incassata`. `annullata` se l'abbonamento si chiude.

**Abbonamento**: `attivo ↔ sospeso → cessato`. Periodicità `mensile | trimestrale | semestrale | annuale`. Le rate si generano in anticipo su un orizzonte (default 12 mesi) in modo idempotente (chiave `abbonamento_id + scadenza`).

## Numerazioni

Per ragione sociale, tipo documento e anno, formato configurabile con `{AAAA}`, `{AA}`, `{N}`, `{NNN}` (zero-padding). Assegnazione atomica con `INSERT … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo`, nella stessa transazione del documento: niente buchi.

## Congelamento

All'emissione (`inviato` per i preventivi, `emessa` per le fatture) si salva `snapshot` = emittente + cliente + regole IVA + totali. Le modifiche successive alle impostazioni non toccano i documenti emessi.

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
- **Fattura da preventivo**: solo da un preventivo `accettato`, con le sole righe una tantum; una fattura per preventivo. All'**emissione** assegna il numero, congela emittente e regole del momento, ricalcola i totali e crea la rata (scadenza a 30 giorni) che compare nello scadenzario.
- **Preventivo**: all'invio (bozza → inviato) assegna il numero e congela emittente, regole e totali.

## Progetti

Un progetto è una commessa per un cliente. Nasce **a mano** da Progetti → Nuovo progetto, oppure **da un preventivo accettato** con «Crea progetto» (mai in automatico: è una scelta dell'utente).

- **Codice**: `PRJ-AAAA-NNN`, progressivo per anno, assegnato nella stessa transazione del progetto (niente buchi) e non modificabile.
- **Cliente**: solo un riferimento a `clienti_ref` (l'anagrafica resta su Twenty). Da preventivo il progetto eredita il cliente del preventivo; l'opportunità Twenty si legge dal preventivo (`twenty_opportunity_id`), non si duplica.
- **Preventivo di origine**: opzionale, e un preventivo può generare **più progetti** (due lavori nello stesso preventivo): `preventivo_id` ha un indice normale, non univoco. Si collega solo un preventivo `accettato`. La creazione da preventivo è una transazione che blocca la riga del preventivo; non è idempotente per scelta, e contro il doppio clic accidentale il pulsante resta disattivato durante l'invio. La pagina del preventivo elenca i progetti collegati e propone sempre «Crea progetto».
- **Categorie**: `software`, `sito_web`, `ecommerce`, `infrastruttura`, `consulenza`, `altro` (elenco fisso, nessun editor).
- **Stati**: `pianificato`, `in_corso`, `in_attesa`, `completato`, `annullato`; si passa liberamente da uno all'altro. **Priorità**: `bassa`, `normale`, `alta`, `urgente`.
- **Date effettive** automatiche: il primo passaggio a `in_corso` (o direttamente a `completato`) fissa l'inizio; `completato` fissa la fine; riaprire un progetto completato cancella la fine. Le date già presenti non si sovrascrivono.
- **Risorse** (`progetto_risorse`): collegamenti esterni (repository, design, produzione, staging, documentazione, infrastruttura, monitoraggio, altro), con ambiente opzionale (`development`, `staging`, `production`) e al più un collegamento principale per progetto (indice univoco parziale). Solo URL `http`/`https`, senza nome utente e password nell'indirizzo. Si eliminano davvero (nessun soft delete: sono semplici collegamenti, l'audit conserva chi li ha tolti). Ogni modifica aggiorna `updated_at` del progetto.
- **Audit**: `progetto.creato`, `progetto.modificato`, `progetto.stato`, `progetto.creato_da_preventivo`, `progetto_risorsa.creata`, `progetto_risorsa.modificata`, `progetto_risorsa.eliminata`.
- Pensato per crescere: stato del progetto separato da un futuro stato dei ticket, risorse in una tabella a parte, nessun JSONB al posto delle entità e nessuna dipendenza dalla fatturazione. Fuori da questa fase: campi personalizzati, tipologie configurabili, ticket, kanban, task, time tracking.
