import { prezzoVisualizzato } from "@telaio/core";
import {
  and,
  asc,
  clientiRef,
  type Database,
  desc,
  eq,
  inArray,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  preventivi,
  ragioniSociali,
  rate,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { z } from "zod";
import { oggi } from "../date";
import { calcolaCashFlow } from "../dominio/cashflow";
import { emettiFattura } from "../dominio/fatture";
import { registraIncasso, registraIncassoSchema } from "../dominio/incassi";
import { creaPreventivoDaListino, creaPreventivoSchema } from "../dominio/preventivi";
import { regoleDa } from "../regole";
import { type Strumento, strumento } from "./base";
import { EXTRA } from "./strumenti-extra";

export const emettiFatturaSchema = z.object({
  fatturaId: z.uuid(),
  giorniScadenza: z.number().int().min(0).max(365).optional(),
});

/**
 * La logica di ogni strumento MCP, in un posto solo: la usa il server quando l'esecuzione è
 * diretta e la usano le azioni in attesa quando l'admin conferma.
 */
const BASE: Record<string, Strumento> = {
  cerca_clienti: strumento(
    { testo: z.string().optional(), limite: z.number().int().min(1).max(50).optional() },
    (_, { testo, limite }) => twentyDaEnv().elencaClienti({ testo, limite }),
  ),

  dettaglio_cliente: strumento({ id: z.string() }, async (db, { id }) => {
    const twenty = twentyDaEnv();
    const cliente = await twenty.dettaglioCliente(id);
    if (!cliente) throw new Error("Cliente non trovato");
    const [persone, opportunita, [ref]] = await Promise.all([
      twenty.elencaPersone(id).catch(() => []),
      twenty.elencaOpportunita(id).catch(() => []),
      db.select().from(clientiRef).where(eq(clientiRef.twentyCompanyId, id)),
    ]);
    const elencoPreventivi = ref
      ? await db
          .select({
            id: preventivi.id,
            numero: preventivi.numero,
            oggetto: preventivi.oggetto,
            stato: preventivi.stato,
            totaleCent: preventivi.totaleCent,
          })
          .from(preventivi)
          .where(and(eq(preventivi.clienteRefId, ref.id), isNull(preventivi.deletedAt)))
          .orderBy(desc(preventivi.createdAt))
      : [];
    return { cliente, persone, opportunita, preventivi: elencoPreventivi };
  }),

  elenca_preventivi: strumento(
    {
      stato: z
        .enum([
          "bozza",
          "inviato",
          "in_revisione",
          "accettato",
          "accettato_parzialmente",
          "rifiutato",
          "scaduto",
        ])
        .optional(),
    },
    (db, { stato }) =>
      db
        .select({
          id: preventivi.id,
          numero: preventivi.numero,
          oggetto: preventivi.oggetto,
          stato: preventivi.stato,
          totaleCent: preventivi.totaleCent,
        })
        .from(preventivi)
        .where(and(isNull(preventivi.deletedAt), stato ? eq(preventivi.stato, stato) : undefined))
        .orderBy(desc(preventivi.createdAt))
        .limit(50),
  ),

  listino: strumento({}, async (db) => {
    const [elenco, basi, moduli, assegn] = await Promise.all([
      db
        .select({ l: listini, rs: ragioniSociali })
        .from(listini)
        .innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId))
        .where(isNull(listini.deletedAt)),
      db.select().from(listinoBasi).where(isNull(listinoBasi.deletedAt)),
      db.select().from(listinoModuli).where(isNull(listinoModuli.deletedAt)),
      db.select().from(moduloBasi),
    ]);
    return elenco.map(({ l, rs }) => {
      const regole = regoleDa(rs);
      const prezzi = (v: {
        unaTantumCent: number;
        canoneAnnuoCent: number;
        canoneMensileCent: number;
      }) => ({
        unaTantum: prezzoVisualizzato(v.unaTantumCent, regole),
        canoneAnnuo: prezzoVisualizzato(v.canoneAnnuoCent, regole),
        canoneMensile: prezzoVisualizzato(v.canoneMensileCent, regole),
      });
      return {
        id: l.id,
        nome: l.nome,
        ragioneSociale: rs.nome,
        basi: basi
          .filter((b) => b.listinoId === l.id)
          .map((b) => ({ id: b.id, nome: b.nome, prezzi: prezzi(b) })),
        moduli: moduli
          .filter((m) => m.listinoId === l.id)
          .map((m) => ({
            id: m.id,
            nome: m.nome,
            prezzi: prezzi(m),
            baseIds: assegn.filter((a) => a.moduloId === m.id).map((a) => a.baseId),
          })),
      };
    });
  }),

  scadenzario: strumento({}, async (db) => {
    const dataOggi = oggi();
    const righe = await db
      .select({ r: rate, cliente: clientiRef.nome })
      .from(rate)
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "parziale", "scaduta"]))
      .orderBy(asc(rate.scadenza))
      .limit(200);
    return righe.map(({ r, cliente }) => ({
      rataId: r.id,
      cliente,
      descrizione: r.descrizione,
      scadenza: r.scadenza,
      importoCent: r.importoCent,
      scaduta: r.scadenza < dataOggi,
      stato: r.stato,
    }));
  }),

  cash_flow: strumento(
    { includiPreventivi: z.boolean().optional(), scenarioPrudente: z.boolean().optional() },
    (db, { includiPreventivi, scenarioPrudente }) =>
      calcolaCashFlow(db, {
        conPreventivi: includiPreventivi ?? true,
        prudente: scenarioPrudente ?? false,
      }),
  ),

  crea_preventivo: strumento(creaPreventivoSchema.shape, async (db, input) =>
    creaPreventivoDaListino(db, creaPreventivoSchema.parse(input)),
  ),

  registra_incasso: strumento(
    { ...registraIncassoSchema.shape, data: registraIncassoSchema.shape.data.optional() },
    async (db, input) => {
      const incasso = await registraIncasso(
        db,
        registraIncassoSchema.parse({ ...input, data: input.data ?? oggi() }),
      );
      return { incassoId: incasso.id };
    },
    (input) => ({ ...input, data: input.data ?? oggi() }),
  ),

  emetti_fattura: strumento(emettiFatturaSchema.shape, (db, { fatturaId, giorniScadenza }) =>
    emettiFattura(db, fatturaId, giorniScadenza),
  ),
};

export const STRUMENTI: Record<string, Strumento> = { ...BASE, ...EXTRA };

/** Valida i parametri di uno strumento e applica i default; lancia se non sono validi. */
export function preparaInput(nome: string, input: unknown): Record<string, unknown> {
  const s = STRUMENTI[nome];
  if (!s) throw new Error(`Strumento sconosciuto: ${nome}`);
  const grezzo = (input ?? {}) as Record<string, unknown>;
  return z.object(s.shape).parse(s.prepara ? s.prepara(grezzo) : grezzo);
}

export async function eseguiStrumento(db: Database, nome: string, input: unknown) {
  const s = STRUMENTI[nome];
  if (!s) throw new Error(`Strumento sconosciuto: ${nome}`);
  return s.esegui(db, preparaInput(nome, input) as never);
}
