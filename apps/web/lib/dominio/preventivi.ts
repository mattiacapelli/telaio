import { type RegoleFiscali, calcolaTotali, importoRiga, moduliCompatibili } from "@telaio/core";
import {
  type Database,
  and,
  clientiRef,
  eq,
  inArray,
  isNull,
  listinoBasi,
  listinoModuli,
  listini,
  moduloBasi,
  preventivi,
  preventivoRighe,
  ragioniSociali,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { z } from "zod";
import { regoleDa } from "../regole";

export const creaPreventivoSchema = z.object({
  ragioneSocialeId: z.uuid(),
  /** id Company di Twenty; assente = cliente ancora da assegnare */
  clienteTwentyId: z.string().min(1).optional(),
  baseId: z.uuid(),
  moduloIds: z.array(z.uuid()).default([]),
  oggetto: z.string().trim().min(1).optional(),
  note: z.string().trim().optional(),
});
export type CreaPreventivoInput = z.infer<typeof creaPreventivoSchema>;

type TipoRiga = "una_tantum" | "canone_annuo" | "canone_mensile";

interface VocePrezzi {
  nome: string;
  unaTantumCent: number;
  canoneAnnuoCent: number;
  canoneMensileCent: number;
}

const ETICHETTE: Record<TipoRiga, string> = {
  una_tantum: "una tantum",
  canone_annuo: "canone annuo",
  canone_mensile: "canone mensile",
};

function righeDaVoce(v: VocePrezzi & { id: string }) {
  const out: { tipo: TipoRiga; descrizione: string; prezzoUnitarioCent: number; voceListinoId: string }[] = [];
  const mappa: [TipoRiga, number][] = [
    ["una_tantum", v.unaTantumCent],
    ["canone_annuo", v.canoneAnnuoCent],
    ["canone_mensile", v.canoneMensileCent],
  ];
  for (const [tipo, prezzo] of mappa) {
    if (prezzo > 0) out.push({ tipo, descrizione: `${v.nome} — ${ETICHETTE[tipo]}`, prezzoUnitarioCent: prezzo, voceListinoId: v.id });
  }
  return out;
}

/**
 * Crea una bozza di preventivo da una base e dai suoi moduli compatibili.
 * Il totale del preventivo (imponibile, IVA, bollo) riguarda le sole righe una tantum;
 * i canoni restano righe a parte e si sommano per tipo.
 */
export async function creaPreventivoDaListino(db: Database, input: CreaPreventivoInput): Promise<{ id: string }> {
  const dati = creaPreventivoSchema.parse(input);

  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, dati.ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
  if (!rs) throw new Error("Ragione sociale non trovata");

  const [base] = await db
    .select({ b: listinoBasi, listinoRs: listini.ragioneSocialeId })
    .from(listinoBasi)
    .innerJoin(listini, eq(listini.id, listinoBasi.listinoId))
    .where(and(eq(listinoBasi.id, dati.baseId), isNull(listinoBasi.deletedAt)));
  if (!base || base.listinoRs !== rs.id) throw new Error("La base non appartiene a un listino di questa ragione sociale");

  // Compatibilità: i moduli devono essere assegnati alla base scelta.
  let moduli: (typeof listinoModuli.$inferSelect)[] = [];
  if (dati.moduloIds.length > 0) {
    const candidati = await db
      .select({ m: listinoModuli, baseId: moduloBasi.baseId })
      .from(listinoModuli)
      .innerJoin(moduloBasi, eq(moduloBasi.moduloId, listinoModuli.id))
      .where(and(inArray(listinoModuli.id, dati.moduloIds), isNull(listinoModuli.deletedAt)));
    const voci = candidati.map((c) => ({
      id: c.m.id,
      tipo: "modulo" as const,
      nome: c.m.nome,
      unaTantumCent: 0,
      canoneAnnuoCent: 0,
      canoneMensileCent: 0,
      baseIds: [c.baseId],
    }));
    const ammessi = new Set(moduliCompatibili(dati.baseId, voci).map((v) => v.id));
    const rifiutati = dati.moduloIds.filter((id) => !ammessi.has(id));
    if (rifiutati.length > 0) throw new Error("Uno o più moduli non sono compatibili con la base scelta");
    moduli = candidati.filter((c) => ammessi.has(c.m.id)).map((c) => c.m);
  }

  // Cliente: riferimento locale a Twenty (upsert), la fonte di verità resta Twenty.
  let clienteRefId: string | null = null;
  let clienteSnapshot: Record<string, unknown> = {};
  if (dati.clienteTwentyId) {
    const cliente = await twentyDaEnv().dettaglioCliente(dati.clienteTwentyId);
    if (!cliente) throw new Error("Cliente non trovato su Twenty");
    const valori = {
      twentyCompanyId: cliente.id,
      nome: cliente.nome,
      partitaIva: cliente.partitaIva,
      codiceFiscale: cliente.codiceFiscale,
      pec: cliente.pec,
      codiceSdi: cliente.codiceSdi,
      pa: cliente.pa,
      lastSyncedAt: new Date(),
    };
    const [ref] = await db
      .insert(clientiRef)
      .values(valori)
      .onConflictDoUpdate({ target: clientiRef.twentyCompanyId, set: valori })
      .returning({ id: clientiRef.id });
    clienteRefId = ref?.id ?? null;
    clienteSnapshot = { ...cliente };
  }

  const regole: RegoleFiscali = regoleDa(rs);
  const righeVoci = [base.b, ...moduli].flatMap((v) => righeDaVoce(v));
  const righe = righeVoci.map((r, i) => ({
    ...r,
    posizione: i,
    quantita: 1,
    scontoBp: 0,
    importoCent: importoRiga({ quantita: 1, prezzoUnitarioCent: r.prezzoUnitarioCent }),
  }));
  const totali = calcolaTotali(righe.filter((r) => r.tipo === "una_tantum"), regole);

  return db.transaction(async (tx) => {
    const [p] = await tx
      .insert(preventivi)
      .values({
        ragioneSocialeId: rs.id,
        clienteRefId,
        anno: new Date().getFullYear(),
        stato: "bozza",
        oggetto: dati.oggetto ?? `${base.b.nome}${moduli.length ? ` + ${moduli.length} moduli` : ""}`,
        note: dati.note || null,
        snapshot: {
          emittente: { id: rs.id, nome: rs.nome, partitaIva: rs.partitaIva, codiceFiscale: rs.codiceFiscale, indirizzo: rs.indirizzo, citta: rs.citta },
          cliente: clienteSnapshot,
          regole: { ...regole },
        },
        imponibileCent: totali.imponibileCent,
        ivaCent: totali.ivaCent,
        bolloCent: totali.bolloCent,
        totaleCent: totali.totaleCent,
      })
      .returning({ id: preventivi.id });
    if (!p) throw new Error("Creazione preventivo fallita");
    if (righe.length > 0) await tx.insert(preventivoRighe).values(righe.map((r) => ({ ...r, preventivoId: p.id })));
    return p;
  });
}
