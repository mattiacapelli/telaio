import {
  abbonamenti,
  and,
  asc,
  clientiRef,
  conti,
  desc,
  eq,
  fatturaRighe,
  fatture,
  gte,
  ilike,
  incassi,
  isNull,
  lt,
  movimenti,
  or,
  pendingActions,
  preventivi,
  preventivoRighe,
  ragioniSociali,
  rate,
  solleciti,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { z } from "zod";
import { oggi, reData } from "../date";
import { cambiaStatoAbbonamento, creaAbbonamento } from "../dominio/abbonamenti";
import { creaFatturaDaPreventivo, creaFatturaLibera } from "../dominio/fatture";
import { registraMovimento, registraMovimentoSchema, saldiConti } from "../dominio/movimenti";
import { cambiaStatoPreventivo } from "../dominio/preventivi-stato";
import {
  confermaSollecitoSchema,
  inviaSollecitoConfermato,
  scartaSollecito,
} from "../dominio/solleciti";
import { intervallo } from "../periodo";
import { regoleDa } from "../regole";
import { type Strumento, strumento } from "./base";

const data = z.string().regex(reData, "Data nel formato AAAA-MM-GG");
const limite = z.number().int().min(1).max(200).optional();
const STATI_PREVENTIVO = [
  "bozza",
  "inviato",
  "in_revisione",
  "accettato",
  "accettato_parzialmente",
  "rifiutato",
  "scaduto",
] as const;

/** Tutti gli altri strumenti: letture su ogni area dell'app e le scritture di dominio. */
export const EXTRA: Record<string, Strumento> = {
  // ── Anagrafiche e configurazione ──────────────────────────────────────────────
  elenca_ragioni_sociali: strumento({}, async (db) => {
    const righe = await db.select().from(ragioniSociali).where(isNull(ragioniSociali.deletedAt));
    return righe.map((r) => ({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo,
      partitaIva: r.partitaIva,
      formatoPreventivo: r.formatoPreventivo,
      formatoFattura: r.formatoFattura,
      regole: regoleDa(r),
    }));
  }),

  elenca_conti: strumento({}, async (db) => {
    const [righe, saldi] = await Promise.all([
      db.select().from(conti).where(isNull(conti.deletedAt)),
      saldiConti(db),
    ]);
    return righe.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      ragioneSocialeId: c.ragioneSocialeId,
      saldoCent: saldi.get(c.id) ?? c.saldoInizialeCent,
    }));
  }),

  crea_conto: strumento(
    {
      nome: z.string().trim().min(1),
      tipo: z.enum(["bonifico", "contante", "carta"]),
      ragioneSocialeId: z.uuid().optional(),
      iban: z.string().optional(),
      saldoInizialeCent: z.number().int().optional(),
    },
    async (db, i) => {
      const [c] = await db
        .insert(conti)
        .values({
          nome: i.nome,
          tipo: i.tipo,
          ragioneSocialeId: i.ragioneSocialeId ?? null,
          iban: i.iban ?? null,
          saldoInizialeCent: i.saldoInizialeCent ?? 0,
        })
        .returning({ id: conti.id });
      return { id: c?.id };
    },
  ),

  // ── Preventivi ───────────────────────────────────────────────────────────────
  dettaglio_preventivo: strumento({ id: z.uuid() }, async (db, { id }) => {
    const [p] = await db
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)));
    if (!p) throw new Error("Preventivo non trovato");
    const righe = await db
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, id))
      .orderBy(asc(preventivoRighe.posizione));
    return { preventivo: p, righe };
  }),

  cambia_stato_preventivo: strumento(
    { id: z.uuid(), stato: z.enum(STATI_PREVENTIVO) },
    (db, { id, stato }) => cambiaStatoPreventivo(db, id, stato),
  ),

  // ── Fatture ──────────────────────────────────────────────────────────────────
  elenca_fatture: strumento(
    { stato: z.string().optional(), da: data.optional(), a: data.optional(), limite },
    async (db, { stato, da, a, limite: n }) => {
      const righe = await db
        .select({ f: fatture, emittente: ragioniSociali.nome, cliente: clientiRef.nome })
        .from(fatture)
        .innerJoin(ragioniSociali, eq(ragioniSociali.id, fatture.ragioneSocialeId))
        .leftJoin(clientiRef, eq(clientiRef.id, fatture.clienteRefId))
        .where(
          and(
            isNull(fatture.deletedAt),
            stato ? sql`${fatture.stato}::text = ${stato}` : undefined,
            da ? gte(fatture.dataEmissione, da) : undefined,
            a ? lt(fatture.dataEmissione, a) : undefined,
          ),
        )
        .orderBy(desc(fatture.createdAt))
        .limit(n ?? 100);
      return righe.map(({ f, emittente, cliente }) => ({
        id: f.id,
        numero: f.numero,
        stato: f.stato,
        emittente,
        cliente: cliente ?? (f.snapshot.cliente as { nome?: string }).nome ?? null,
        dataEmissione: f.dataEmissione,
        scadenza: f.scadenza,
        imponibileCent: f.imponibileCent,
        ivaCent: f.ivaCent,
        totaleCent: f.totaleCent,
        nettoDaPagareCent: f.nettoDaPagareCent,
      }));
    },
  ),

  dettaglio_fattura: strumento({ id: z.uuid() }, async (db, { id }) => {
    const [f] = await db
      .select()
      .from(fatture)
      .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)));
    if (!f) throw new Error("Fattura non trovata");
    const [righe, versati] = await Promise.all([
      db
        .select()
        .from(fatturaRighe)
        .where(eq(fatturaRighe.fatturaId, id))
        .orderBy(asc(fatturaRighe.posizione)),
      db
        .select()
        .from(incassi)
        .where(and(eq(incassi.fatturaId, id), isNull(incassi.deletedAt))),
    ]);
    return { fattura: f, righe, incassi: versati };
  }),

  crea_fattura_da_preventivo: strumento({ preventivoId: z.uuid() }, (db, { preventivoId }) =>
    creaFatturaDaPreventivo(db, preventivoId),
  ),

  crea_fattura_libera: strumento(
    {
      ragioneSocialeId: z.uuid(),
      clienteRefId: z
        .uuid()
        .optional()
        .describe("Cliente già presente in Telaio; in alternativa `cliente`"),
      cliente: z
        .object({
          nome: z.string().min(1),
          partitaIva: z.string().optional(),
          codiceFiscale: z.string().optional(),
          indirizzo: z.string().optional(),
          sdiPec: z.string().optional(),
          privato: z.boolean().optional(),
        })
        .optional(),
      note: z.string().optional(),
      righe: z
        .array(
          z.object({
            descrizione: z.string().min(1),
            quantita: z.number().int().min(1).default(1),
            prezzoUnitarioCent: z.number().int().min(0),
            scontoBp: z.number().int().min(0).max(10000).default(0),
          }),
        )
        .min(1),
    },
    (db, i) =>
      creaFatturaLibera(db, {
        ragioneSocialeId: i.ragioneSocialeId,
        clienteRefId: i.clienteRefId ?? null,
        occasionale: i.cliente
          ? {
              nome: i.cliente.nome,
              partitaIva: i.cliente.partitaIva ?? null,
              codiceFiscale: i.cliente.codiceFiscale ?? null,
              indirizzo: i.cliente.indirizzo ?? null,
              sdiPec: i.cliente.sdiPec ?? null,
              privato: i.cliente.privato ?? false,
            }
          : null,
        note: i.note ?? null,
        righe: i.righe,
      }),
  ),

  // ── Incassi, prima nota, scadenzario ─────────────────────────────────────────
  elenca_incassi: strumento(
    { da: data.optional(), a: data.optional(), limite },
    async (db, { da, a, limite: n }) => {
      const righe = await db
        .select({ i: incassi, conto: conti.nome, cliente: clientiRef.nome })
        .from(incassi)
        .innerJoin(conti, eq(conti.id, incassi.contoId))
        .leftJoin(clientiRef, eq(clientiRef.id, incassi.clienteRefId))
        .where(
          and(
            isNull(incassi.deletedAt),
            da ? gte(incassi.data, da) : undefined,
            a ? lt(incassi.data, a) : undefined,
          ),
        )
        .orderBy(desc(incassi.data))
        .limit(n ?? 100);
      return righe.map(({ i, conto, cliente }) => ({
        id: i.id,
        data: i.data,
        importoCent: i.importoCent,
        conto,
        cliente,
        rataId: i.rataId,
        fatturaId: i.fatturaId,
        descrizione: i.descrizione,
      }));
    },
  ),

  elenca_movimenti: strumento(
    {
      tipo: z.enum(["entrata", "uscita", "giroconto"]).optional(),
      da: data.optional(),
      a: data.optional(),
      limite,
    },
    async (db, { tipo, da, a, limite: n }) =>
      db
        .select({
          id: movimenti.id,
          tipo: movimenti.tipo,
          data: movimenti.data,
          importoCent: movimenti.importoCent,
          contoId: movimenti.contoId,
          categoria: movimenti.categoria,
          descrizione: movimenti.descrizione,
        })
        .from(movimenti)
        .where(
          and(
            isNull(movimenti.deletedAt),
            tipo ? eq(movimenti.tipo, tipo) : undefined,
            da ? gte(movimenti.data, da) : undefined,
            a ? lt(movimenti.data, a) : undefined,
          ),
        )
        .orderBy(desc(movimenti.data))
        .limit(n ?? 100),
  ),

  registra_movimento: strumento(registraMovimentoSchema.shape, async (db, i) => {
    await registraMovimento(db, registraMovimentoSchema.parse(i));
    return { ok: true };
  }),

  elenca_solleciti: strumento(
    { stato: z.enum(["da_confermare", "inviato", "annullato", "programmato"]).optional() },
    async (db, { stato }) => {
      const righe = await db
        .select({ s: solleciti, r: rate, cliente: clientiRef.nome })
        .from(solleciti)
        .innerJoin(rate, eq(rate.id, solleciti.rataId))
        .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
        .where(eq(solleciti.stato, stato ?? "da_confermare"))
        .orderBy(asc(rate.scadenza))
        .limit(100);
      return righe.map(({ s, r, cliente }) => ({
        id: s.id,
        stato: s.stato,
        livello: s.livello,
        cliente,
        rata: r.descrizione,
        scadenza: r.scadenza,
        importoCent: r.importoCent,
        oggetto: s.oggetto,
        corpo: s.corpo,
        destinatario: s.destinatario,
      }));
    },
  ),

  invia_sollecito: strumento(confermaSollecitoSchema.shape, async (db, i) => {
    await inviaSollecitoConfermato(db, confermaSollecitoSchema.parse(i));
    return { inviato: true };
  }),

  scarta_sollecito: strumento({ id: z.uuid() }, async (db, { id }) => {
    await scartaSollecito(db, id);
    return { scartato: true };
  }),

  // ── Abbonamenti ──────────────────────────────────────────────────────────────
  elenca_abbonamenti: strumento(
    { stato: z.enum(["attivo", "sospeso", "cessato"]).optional() },
    async (db, { stato }) => {
      const righe = await db
        .select({ a: abbonamenti, cliente: clientiRef.nome })
        .from(abbonamenti)
        .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
        .where(and(isNull(abbonamenti.deletedAt), stato ? eq(abbonamenti.stato, stato) : undefined))
        .orderBy(desc(abbonamenti.createdAt));
      return righe.map(({ a, cliente }) => ({
        id: a.id,
        cliente,
        descrizione: a.descrizione,
        periodicita: a.periodicita,
        importoRataCent: a.importoRataCent,
        inizio: a.inizio,
        fine: a.fine,
        stato: a.stato,
      }));
    },
  ),

  dettaglio_abbonamento: strumento({ id: z.uuid() }, async (db, { id }) => {
    const [a] = await db
      .select()
      .from(abbonamenti)
      .where(and(eq(abbonamenti.id, id), isNull(abbonamenti.deletedAt)));
    if (!a) throw new Error("Abbonamento non trovato");
    const lista = await db
      .select()
      .from(rate)
      .where(eq(rate.abbonamentoId, id))
      .orderBy(asc(rate.scadenza));
    return { abbonamento: a, rate: lista };
  }),

  crea_abbonamento: strumento(
    {
      ragioneSocialeId: z.uuid(),
      clienteRefId: z.uuid(),
      descrizione: z.string().trim().min(1),
      periodicita: z.enum(["mensile", "trimestrale", "semestrale", "annuale"]),
      importoRataCent: z.number().int().positive(),
      inizio: data,
      fine: data.optional(),
    },
    (db, i) => creaAbbonamento(db, { ...i, fine: i.fine ?? null }),
  ),

  cambia_stato_abbonamento: strumento(
    { id: z.uuid(), stato: z.enum(["attivo", "sospeso", "cessato"]) },
    async (db, { id, stato }) => {
      const a = await cambiaStatoAbbonamento(db, id, stato, oggi());
      return { id: a.id, stato: a.stato };
    },
  ),

  // ── Analisi ──────────────────────────────────────────────────────────────────
  riepilogo: strumento({}, async (db) => {
    const dataOggi = oggi();
    const inizioMese = `${dataOggi.slice(0, 7)}-01`;
    const [[prev], [inc], [dov], [can], [coda], saldi] = await Promise.all([
      db.execute<{ n: number; netto: number; totale: number }>(
        sql`select count(*)::int n, coalesce(sum(imponibile_cent),0)::int netto, coalesce(sum(totale_cent),0)::int totale from preventivi where stato in ('inviato','in_revisione') and deleted_at is null`,
      ),
      db.execute<{ n: number; tot: number }>(
        sql`select count(*)::int n, coalesce(sum(importo_cent),0)::int tot from incassi where deleted_at is null and data >= ${inizioMese}`,
      ),
      db.execute<{ da_incassare: number; scaduto: number; n_scadute: number }>(sql`
        select coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)),0)::int da_incassare,
               coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) filter (where r.stato = 'scaduta'),0)::int scaduto,
               count(*) filter (where r.stato = 'scaduta')::int n_scadute
        from rate r where r.stato in ('da_incassare','parziale','scaduta')`),
      db.execute<{ n: number; annuo: number }>(
        sql`select count(*)::int n, coalesce(sum(importo_rata_cent * (case periodicita when 'mensile' then 12 when 'trimestrale' then 4 when 'semestrale' then 2 else 1 end)),0)::int annuo from abbonamenti where stato = 'attivo' and deleted_at is null`,
      ),
      db.execute<{ solleciti: number; azioni: number; bozze: number }>(
        sql`select (select count(*) from solleciti where stato = 'da_confermare')::int solleciti, (select count(*) from pending_actions where stato = 'in_attesa')::int azioni, (select count(*) from fatture where stato = 'bozza' and deleted_at is null)::int bozze`,
      ),
      saldiConti(db),
    ]);
    return {
      data: dataOggi,
      preventiviInAttesa: {
        n: prev?.n ?? 0,
        nettoCent: prev?.netto ?? 0,
        totaleCent: prev?.totale ?? 0,
      },
      incassatoMese: { movimenti: inc?.n ?? 0, totaleCent: inc?.tot ?? 0 },
      daIncassare: {
        totaleCent: dov?.da_incassare ?? 0,
        scadutoCent: dov?.scaduto ?? 0,
        rateScadute: dov?.n_scadute ?? 0,
      },
      canoni: { abbonamentiAttivi: can?.n ?? 0, annuoNettoCent: can?.annuo ?? 0 },
      liquiditaCent: [...saldi.values()].reduce((a, b) => a + b, 0),
      daSistemare: {
        sollecitiDaConfermare: coda?.solleciti ?? 0,
        azioniInAttesa: coda?.azioni ?? 0,
        fattureInBozza: coda?.bozze ?? 0,
      },
    };
  }),

  report: strumento(
    { periodo: z.enum(["mese", "trimestre", "anno"]).optional() },
    async (db, { periodo }) => {
      const { da, a, etichetta } = intervallo(periodo ?? "anno", oggi());
      const [ricavi, costi] = await Promise.all([
        db
          .select({
            emittente: ragioniSociali.nome,
            imponibileCent: sql<number>`coalesce(sum(${fatture.imponibileCent}),0)::int`,
            ivaCent: sql<number>`coalesce(sum(${fatture.ivaCent}),0)::int`,
            fatture: sql<number>`count(*)::int`,
          })
          .from(fatture)
          .innerJoin(ragioniSociali, eq(ragioniSociali.id, fatture.ragioneSocialeId))
          .where(
            and(
              isNull(fatture.deletedAt),
              gte(fatture.dataEmissione, da),
              lt(fatture.dataEmissione, a),
              sql`${fatture.stato}::text <> 'bozza'`,
            ),
          )
          .groupBy(ragioniSociali.nome),
        db
          .select({ tot: sql<number>`coalesce(sum(${movimenti.importoCent}),0)::int` })
          .from(movimenti)
          .where(
            and(
              isNull(movimenti.deletedAt),
              eq(movimenti.tipo, "uscita"),
              gte(movimenti.data, da),
              lt(movimenti.data, a),
            ),
          ),
      ]);
      const ricaviCent = ricavi.reduce((s, r) => s + r.imponibileCent, 0);
      const costiCent = costi[0]?.tot ?? 0;
      return {
        periodo: etichetta,
        ricaviNettiCent: ricaviCent,
        ivaFatturataCent: ricavi.reduce((s, r) => s + r.ivaCent, 0),
        costiNettiCent: costiCent,
        margineCent: ricaviCent - costiCent,
        perEmittente: ricavi,
      };
    },
  ),

  cerca: strumento({ testo: z.string().min(2) }, async (db, { testo }) => {
    const like = `%${testo}%`;
    const [clienti, prev, fatt] = await Promise.all([
      twentyDaEnv()
        .elencaClienti({ testo, limite: 8 })
        .catch(() => []),
      db
        .select({ id: preventivi.id, numero: preventivi.numero, oggetto: preventivi.oggetto })
        .from(preventivi)
        .where(
          and(
            isNull(preventivi.deletedAt),
            or(ilike(preventivi.oggetto, like), ilike(preventivi.numero, like)),
          ),
        )
        .limit(8),
      db
        .select({ id: fatture.id, numero: fatture.numero })
        .from(fatture)
        .where(and(isNull(fatture.deletedAt), ilike(fatture.numero, like)))
        .limit(8),
    ]);
    return {
      clienti: clienti.map((c) => ({ id: c.id, nome: c.nome })),
      preventivi: prev,
      fatture: fatt,
    };
  }),

  // ── CRM e coda ───────────────────────────────────────────────────────────────
  elenca_opportunita: strumento({ companyId: z.string().optional() }, (_, { companyId }) =>
    twentyDaEnv().elencaOpportunita(companyId),
  ),

  aggiorna_fase_opportunita: strumento(
    { id: z.string(), fase: z.string().min(1) },
    async (_, { id, fase }) => {
      await twentyDaEnv().aggiornaFaseOpportunita(id, fase);
      return { ok: true };
    },
  ),

  elenca_azioni_in_attesa: strumento({}, async (db) =>
    db
      .select({
        id: pendingActions.id,
        tipo: pendingActions.tipo,
        origine: pendingActions.origine,
        payload: pendingActions.payload,
        creataIl: pendingActions.createdAt,
      })
      .from(pendingActions)
      .where(eq(pendingActions.stato, "in_attesa"))
      .orderBy(desc(pendingActions.createdAt))
      .limit(50),
  ),
};
