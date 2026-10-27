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
- Sistema: **api_keys**, **webhooks**, **webhook_deliveries**, **pending_actions**, **audit_log**, **numerazioni**.

## Regole fiscali (per ragione sociale)

| Campo | Significato |
|---|---|
| `iva_attiva` | se falso: nessuna IVA, vale la dicitura |
| `aliquota_iva_bp` | es. 2200 |
| `natura_senza_iva` + `dicitura_senza_iva` | es. `N2.2`, `N4`, con testo di legge |
| `bollo_automatico` | solo senza IVA: € 2,00 se imponibile > € 77,47 |
| `ritenuta_bp` | ritenuta d'acconto sull'imponibile (opzionale) |
| `split_payment` | IVA versata dal cliente PA direttamente all'erario |

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

| Caso | Imponibile | IVA | Bollo | Totale | Ritenuta | Da pagare |
|---|---|---|---|---|---|---|
| IVA 22 % | 1.000,00 | 220,00 | – | 1.220,00 | – | 1.220,00 |
| IVA 22 % + split PA | 1.000,00 | 220,00 | – | 1.220,00 | – | 1.000,00 |
| Senza IVA (N2.2), bollo | 1.000,00 | – | 2,00 | 1.002,00 | – | 1.002,00 |
| Senza IVA, € 70,00 | 70,00 | – | – | 70,00 | – | 70,00 |
| IVA 22 % + ritenuta 20 % | 1.000,00 | 220,00 | – | 1.220,00 | 200,00 | 1.020,00 |

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
