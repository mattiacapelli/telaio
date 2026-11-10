import { accettazioneInputSchema } from "@telaio/core";
import {
  accettaPreventivo,
  and,
  auditLog,
  clientiRef,
  conti,
  desc,
  eq,
  gte,
  incassi,
  isNull,
  lt,
  movimenti,
  rate,
} from "@telaio/db";
import { z } from "zod";
import {
  eliminaFatturaBozza,
  fatturaBozzaModificaSchema,
  modificaDateFattura,
  modificaFatturaBozza,
} from "../dominio/fatture";
import {
  abbonamentoModificaSchema,
  annullaRata,
  eliminaAbbonamento,
  eliminaIncasso,
  eliminaMovimento,
  incassoModificaSchema,
  modificaAbbonamento,
  modificaIncasso,
  modificaMovimento,
  modificaRata,
  movimentoModificaSchema,
  rataModificaSchema,
} from "../dominio/gestione";
import {
  aggiornaPreventivoBozza,
  creaPreventivoLibero,
  creaPreventivoLiberoSchema,
  eliminaPreventivoBozza,
  modificaDataPreventivo,
} from "../dominio/preventivi";
import { emettiEvento } from "../webhooks";
import { type Strumento, strumento } from "./base";
import { data, id, limite } from "./schemi";

/** Modifiche e cancellazioni di preventivi, fatture, incassi, prima nota, abbonamenti e rate. */
export const CONTABILITA: Record<string, Strumento> = {
  // ── Preventivi ───────────────────────────────────────────────────────────────
  crea_preventivo_libero: strumento(creaPreventivoLiberoSchema.shape, (db, i) =>
    creaPreventivoLibero(db, creaPreventivoLiberoSchema.parse(i)),
  ),
  modifica_preventivo_bozza: strumento(
    { id, ...creaPreventivoLiberoSchema.shape },
    async (db, { id: preventivoId, ...dati }) => {
      await aggiornaPreventivoBozza(db, preventivoId, creaPreventivoLiberoSchema.parse(dati));
      return { id: preventivoId };
    },
  ),
  elimina_preventivo_bozza: strumento({ id }, (db, { id: preventivoId }) =>
    eliminaPreventivoBozza(db, preventivoId),
  ),
  modifica_data_preventivo: strumento({ id, data }, (db, { id: preventivoId, data: nuova }) =>
    modificaDataPreventivo(db, preventivoId, nuova),
  ),
  accetta_preventivo: strumento(
    { id, ...accettazioneInputSchema.shape },
    async (db, { id: preventivoId, ...input }) => {
      const esito = await accettaPreventivo(db, preventivoId, input);
      await emettiEvento(db, "preventivo.stato", {
        preventivoId,
        stato: esito.stato,
        numero: esito.numero,
      });
      return esito;
    },
  ),

  // ── Fatture ──────────────────────────────────────────────────────────────────
  modifica_fattura_bozza: strumento(
    { id, ...fatturaBozzaModificaSchema.shape },
    (db, { id: fatturaId, ...dati }) => modificaFatturaBozza(db, fatturaId, dati),
  ),
  elimina_fattura_bozza: strumento({ id }, (db, { id: fatturaId }) =>
    eliminaFatturaBozza(db, fatturaId),
  ),
  modifica_date_fattura: strumento(
    { id, dataEmissione: data, scadenza: data },
    async (db, { id: fatturaId, ...date }) => {
      await modificaDateFattura(db, fatturaId, date);
      return { id: fatturaId, ...date };
    },
  ),

  // ── Incassi ──────────────────────────────────────────────────────────────────
  dettaglio_incasso: strumento({ id }, async (db, { id: incassoId }) => {
    const [r] = await db
      .select({ i: incassi, conto: conti.nome, cliente: clientiRef.nome })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .leftJoin(clientiRef, eq(clientiRef.id, incassi.clienteRefId))
      .where(and(eq(incassi.id, incassoId), isNull(incassi.deletedAt)));
    if (!r) throw new Error("Incasso non trovato");
    return { ...r.i, conto: r.conto, cliente: r.cliente };
  }),
  modifica_incasso: strumento(
    { id, ...incassoModificaSchema.partial().shape },
    (db, { id: incassoId, ...dati }) => modificaIncasso(db, incassoId, dati),
  ),
  elimina_incasso: strumento({ id }, (db, { id: incassoId }) => eliminaIncasso(db, incassoId)),

  // ── Prima nota ───────────────────────────────────────────────────────────────
  dettaglio_movimento: strumento({ id }, async (db, { id: movimentoId }) => {
    const [m] = await db
      .select()
      .from(movimenti)
      .where(and(eq(movimenti.id, movimentoId), isNull(movimenti.deletedAt)));
    if (!m) throw new Error("Movimento non trovato");
    return m;
  }),
  modifica_movimento: strumento(
    { id, ...movimentoModificaSchema.partial().shape },
    (db, { id: movimentoId, ...dati }) => modificaMovimento(db, movimentoId, dati),
  ),
  elimina_movimento: strumento({ id }, (db, { id: movimentoId }) =>
    eliminaMovimento(db, movimentoId),
  ),

  // ── Abbonamenti ──────────────────────────────────────────────────────────────
  modifica_abbonamento: strumento(
    { id, ...abbonamentoModificaSchema.partial().shape },
    (db, { id: abbonamentoId, ...dati }) => modificaAbbonamento(db, abbonamentoId, dati),
  ),
  elimina_abbonamento: strumento({ id }, (db, { id: abbonamentoId }) =>
    eliminaAbbonamento(db, abbonamentoId),
  ),

  // ── Rate dello scadenzario ───────────────────────────────────────────────────
  dettaglio_rata: strumento({ id }, async (db, { id: rataId }) => {
    const [r] = await db.select().from(rate).where(eq(rate.id, rataId));
    if (!r) throw new Error("Rata non trovata");
    const versati = await db
      .select()
      .from(incassi)
      .where(and(eq(incassi.rataId, rataId), isNull(incassi.deletedAt)));
    return { rata: r, incassi: versati };
  }),
  modifica_rata: strumento(
    { id, ...rataModificaSchema.partial().shape },
    (db, { id: rataId, ...dati }) => modificaRata(db, rataId, dati),
  ),
  annulla_rata: strumento({ id }, (db, { id: rataId }) => annullaRata(db, rataId)),

  // ── Registro delle operazioni ────────────────────────────────────────────────
  elenca_audit: strumento(
    {
      entita: z.string().optional().describe("es. preventivi, fatture, progetti, ticket"),
      entitaId: z.string().optional(),
      azione: z.string().optional(),
      da: data.optional(),
      a: data.optional(),
      limite,
    },
    async (db, { entita, entitaId, azione, da, a, limite: n }) =>
      db
        .select()
        .from(auditLog)
        .where(
          and(
            entita ? eq(auditLog.entita, entita) : undefined,
            entitaId ? eq(auditLog.entitaId, entitaId) : undefined,
            azione ? eq(auditLog.azione, azione) : undefined,
            da ? gte(auditLog.createdAt, new Date(`${da}T00:00:00`)) : undefined,
            a ? lt(auditLog.createdAt, new Date(`${a}T00:00:00`)) : undefined,
          ),
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(n ?? 50),
  ),
};
