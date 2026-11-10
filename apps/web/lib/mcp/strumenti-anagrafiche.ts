import { mittenteSchema } from "@telaio/core";
import {
  and,
  asc,
  conti,
  eq,
  isNull,
  leggiEmail,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
  salvaFirmaEmail,
  salvaMittente,
} from "@telaio/db";
import { z } from "zod";
import {
  archiviaConto,
  archiviaListino,
  archiviaRagioneSociale,
  archiviaVoceListino,
  contoModificaSchema,
  creaListino,
  creaRagioneSociale,
  creaVoceListino,
  listinoModificaSchema,
  listinoSchema,
  modificaConto,
  modificaListino,
  modificaRagioneSociale,
  modificaRegoleFiscali,
  modificaVoceListino,
  ragioneSocialeModificaSchema,
  ragioneSocialeSchema,
  regoleFiscaliSchema,
  voceListinoModificaSchema,
  voceListinoSchema,
} from "../dominio/anagrafiche";
import { saldiConti } from "../dominio/movimenti";
import { regoleDa } from "../regole";
import { type Strumento, strumento } from "./base";
import { id } from "./schemi";

const baseIds = z
  .array(z.uuid())
  .describe("Basi del listino a cui il modulo è assegnabile (sostituisce l'elenco attuale)");

/** Ragioni sociali, regole fiscali, conti, listini e impostazioni delle email. */
export const ANAGRAFICHE: Record<string, Strumento> = {
  // ── Ragioni sociali ──────────────────────────────────────────────────────────
  dettaglio_ragione_sociale: strumento({ id }, async (db, { id: rsId }) => {
    const [r] = await db
      .select()
      .from(ragioniSociali)
      .where(and(eq(ragioniSociali.id, rsId), isNull(ragioniSociali.deletedAt)));
    if (!r) throw new Error("Ragione sociale non trovata");
    return { ...r, regole: regoleDa(r) };
  }),
  crea_ragione_sociale: strumento(ragioneSocialeSchema.shape, (db, i) => creaRagioneSociale(db, i)),
  modifica_ragione_sociale: strumento(
    { id, ...ragioneSocialeModificaSchema.shape },
    (db, { id: rsId, ...dati }) => modificaRagioneSociale(db, rsId, dati),
  ),
  modifica_regole_fiscali: strumento(
    { id, ...regoleFiscaliSchema.partial().shape },
    (db, { id: rsId, ...dati }) => modificaRegoleFiscali(db, rsId, dati),
  ),
  elimina_ragione_sociale: strumento({ id }, (db, { id: rsId }) =>
    archiviaRagioneSociale(db, rsId),
  ),

  // ── Conti ────────────────────────────────────────────────────────────────────
  dettaglio_conto: strumento({ id }, async (db, { id: contoId }) => {
    const [c] = await db
      .select()
      .from(conti)
      .where(and(eq(conti.id, contoId), isNull(conti.deletedAt)));
    if (!c) throw new Error("Conto non trovato");
    const saldi = await saldiConti(db);
    return { ...c, saldoCent: saldi.get(c.id) ?? c.saldoInizialeCent };
  }),
  modifica_conto: strumento(
    { id, ...contoModificaSchema.partial().shape },
    (db, { id: contoId, ...dati }) => modificaConto(db, contoId, dati),
  ),
  elimina_conto: strumento({ id }, (db, { id: contoId }) => archiviaConto(db, contoId)),

  // ── Listini ──────────────────────────────────────────────────────────────────
  dettaglio_listino: strumento({ id }, async (db, { id: listinoId }) => {
    const [l] = await db
      .select()
      .from(listini)
      .where(and(eq(listini.id, listinoId), isNull(listini.deletedAt)));
    if (!l) throw new Error("Listino non trovato");
    const [basi, moduli, assegnazioni] = await Promise.all([
      db
        .select()
        .from(listinoBasi)
        .where(and(eq(listinoBasi.listinoId, listinoId), isNull(listinoBasi.deletedAt)))
        .orderBy(asc(listinoBasi.ordine)),
      db
        .select()
        .from(listinoModuli)
        .where(and(eq(listinoModuli.listinoId, listinoId), isNull(listinoModuli.deletedAt)))
        .orderBy(asc(listinoModuli.ordine)),
      db.select().from(moduloBasi),
    ]);
    return {
      listino: l,
      basi,
      moduli: moduli.map((m) => ({
        ...m,
        baseIds: assegnazioni.filter((a) => a.moduloId === m.id).map((a) => a.baseId),
      })),
    };
  }),
  crea_listino: strumento(listinoSchema.shape, (db, i) => creaListino(db, i)),
  modifica_listino: strumento(
    { id, ...listinoModificaSchema.omit({ ragioneSocialeId: true }).shape },
    (db, { id: listinoId, ...dati }) => modificaListino(db, listinoId, dati),
  ),
  elimina_listino: strumento({ id }, (db, { id: listinoId }) => archiviaListino(db, listinoId)),

  crea_base_listino: strumento(voceListinoSchema.shape, (db, i) => creaVoceListino(db, "base", i)),
  modifica_base_listino: strumento(
    { id, ...voceListinoModificaSchema.omit({ listinoId: true }).shape },
    (db, { id: voceId, ...dati }) => modificaVoceListino(db, "base", voceId, dati),
  ),
  elimina_base_listino: strumento({ id }, (db, { id: voceId }) =>
    archiviaVoceListino(db, "base", voceId),
  ),

  crea_modulo_listino: strumento(
    { ...voceListinoSchema.shape, baseIds: baseIds.optional() },
    (db, { baseIds: basi, ...dati }) => creaVoceListino(db, "modulo", dati, basi ?? []),
  ),
  modifica_modulo_listino: strumento(
    {
      id,
      ...voceListinoModificaSchema.omit({ listinoId: true }).shape,
      baseIds: baseIds.optional(),
    },
    (db, { id: voceId, baseIds: basi, ...dati }) =>
      modificaVoceListino(db, "modulo", voceId, dati, basi),
  ),
  elimina_modulo_listino: strumento({ id }, (db, { id: voceId }) =>
    archiviaVoceListino(db, "modulo", voceId),
  ),

  // ── Email: firma e mittenti (le credenziali SMTP restano nell'ambiente) ──────────
  leggi_impostazioni_email: strumento({}, (db) => leggiEmail(db)),
  imposta_firma_email: strumento(
    { firma: z.string().max(500, "Al massimo 500 caratteri") },
    async (db, { firma }) => {
      await salvaFirmaEmail(db, firma);
      return { ok: true };
    },
  ),
  imposta_mittente_email: strumento(
    { ragioneSocialeId: id, ...mittenteSchema.shape },
    async (db, { ragioneSocialeId, ...mittente }) => {
      const [r] = await db
        .select({ id: ragioniSociali.id })
        .from(ragioniSociali)
        .where(and(eq(ragioniSociali.id, ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
      if (!r) throw new Error("Ragione sociale non trovata");
      await salvaMittente(db, ragioneSocialeId, mittenteSchema.parse(mittente));
      return { ok: true };
    },
  ),
};
