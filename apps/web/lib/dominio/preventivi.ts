import { randomUUID } from "node:crypto";
import {
  calcolaTotali,
  erroreGruppi,
  importoRiga,
  moduliCompatibili,
  type RegoleFiscali,
} from "@telaio/core";
import {
  and,
  type Database,
  eq,
  inArray,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  preventivi,
  preventivoRighe,
  ragioniSociali,
} from "@telaio/db";
import { z } from "zod";
import { oggi } from "../date";
import { regoleDa } from "../regole";
import { emettiEvento } from "../webhooks";
import { risolviClienteRef } from "./cliente-ref";

function aggiungiGiorni(data: string, giorni: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export const creaPreventivoSchema = z.object({
  ragioneSocialeId: z.uuid(),
  /** id Company di Twenty; assente = cliente ancora da assegnare */
  clienteTwentyId: z.string().min(1).optional(),
  baseId: z.uuid(),
  moduloIds: z.array(z.uuid()).default([]),
  oggetto: z.string().trim().min(1).optional(),
  note: z.string().trim().optional(),
  /** sconto sulle sole righe una tantum, in punti base (1000 = 10%) */
  scontoUnaTantumBp: z.number().int().min(0).max(10000).default(0),
  /** giorni di validità dall'emissione; vuoto = nessuna scadenza */
  validitaGiorni: z.number().int().min(1).max(365).optional(),
});
export type CreaPreventivoInput = z.infer<typeof creaPreventivoSchema>;

type TipoRiga = "una_tantum" | "canone_annuo" | "canone_mensile";

export const rigaLiberaSchema = z.object({
  descrizione: z.string().trim().min(1, "Scrivi la descrizione di ogni riga").max(500),
  tipo: z.enum(["una_tantum", "canone_annuo", "canone_mensile"]).default("una_tantum"),
  quantita: z.number().int().min(1).max(100000).default(1),
  prezzoUnitarioCent: z.number().int().min(0).max(100_000_000),
  scontoBp: z.number().int().min(0).max(10000).default(0),
  /** voce di listino di origine, se la riga è stata scelta da un listino */
  voceListinoId: z.uuid().optional(),
  /**
   * Chiave scelta dal client: le righe con la stessa chiave sono alternative dello stesso servizio
   * (canone annuo oppure mensile, mai entrambi). Il server la sostituisce con un identificativo.
   */
  gruppoAlternativa: z.string().trim().min(1).max(64).nullish(),
});
export type RigaLibera = z.infer<typeof rigaLiberaSchema>;

export const creaPreventivoLiberoSchema = z
  .object({
    ragioneSocialeId: z.uuid(),
    clienteTwentyId: z.string().min(1).optional(),
    righe: z.array(rigaLiberaSchema).min(1, "Aggiungi almeno una riga").max(200),
    oggetto: z.string().trim().min(1).optional(),
    note: z.string().trim().optional(),
    validitaGiorni: z.number().int().min(1).max(365).optional(),
  })
  .superRefine((v, ctx) => {
    const errore = erroreGruppi(
      v.righe.map((r, i) => ({
        id: String(i),
        tipo: r.tipo,
        quantita: r.quantita,
        prezzoUnitarioCent: r.prezzoUnitarioCent,
        scontoBp: r.scontoBp,
        gruppoAlternativaId: r.gruppoAlternativa ?? null,
      })),
    );
    if (errore) ctx.addIssue({ code: "custom", path: ["righe"], message: errore });
  });
export type CreaPreventivoLiberoInput = z.infer<typeof creaPreventivoLiberoSchema>;

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
  const out: {
    tipo: TipoRiga;
    descrizione: string;
    prezzoUnitarioCent: number;
    voceListinoId: string;
    gruppoAlternativa: string | null;
  }[] = [];
  const mappa: [TipoRiga, number][] = [
    ["una_tantum", v.unaTantumCent],
    ["canone_annuo", v.canoneAnnuoCent],
    ["canone_mensile", v.canoneMensileCent],
  ];
  // Canone annuo e mensile della stessa voce sono alternative: il cliente ne sceglie una.
  const alternative = v.canoneAnnuoCent > 0 && v.canoneMensileCent > 0;
  for (const [tipo, prezzo] of mappa) {
    if (prezzo > 0)
      out.push({
        tipo,
        descrizione: `${v.nome} — ${ETICHETTE[tipo]}`,
        prezzoUnitarioCent: prezzo,
        voceListinoId: v.id,
        gruppoAlternativa: alternative && tipo !== "una_tantum" ? `voce-${v.id}` : null,
      });
  }
  return out;
}

/**
 * Crea una bozza di preventivo da una base e dai suoi moduli compatibili.
 * Il totale del preventivo (imponibile, IVA, bollo) riguarda le sole righe una tantum;
 * i canoni restano righe a parte e si sommano per tipo.
 */
export async function creaPreventivoDaListino(
  db: Database,
  input: CreaPreventivoInput,
): Promise<{ id: string }> {
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
  if (!base || base.listinoRs !== rs.id)
    throw new Error("La base non appartiene a un listino di questa ragione sociale");

  // Compatibilità: i moduli devono essere assegnati alla base scelta.
  let moduli: (typeof listinoModuli.$inferSelect)[] = [];
  if (dati.moduloIds.length > 0) {
    const righeModuli = await db
      .select({ m: listinoModuli, baseId: moduloBasi.baseId })
      .from(listinoModuli)
      .innerJoin(moduloBasi, eq(moduloBasi.moduloId, listinoModuli.id))
      .where(and(inArray(listinoModuli.id, dati.moduloIds), isNull(listinoModuli.deletedAt)));
    // Un modulo può essere assegnato a più basi: una sola voce per modulo, con tutte le sue basi.
    const perModulo = new Map<
      string,
      { m: typeof listinoModuli.$inferSelect; baseIds: string[] }
    >();
    for (const { m, baseId } of righeModuli) {
      const voce = perModulo.get(m.id) ?? { m, baseIds: [] };
      voce.baseIds.push(baseId);
      perModulo.set(m.id, voce);
    }
    const ammessi = new Set(
      moduliCompatibili(
        dati.baseId,
        [...perModulo.values()].map(({ m, baseIds }) => ({
          id: m.id,
          tipo: "modulo" as const,
          nome: m.nome,
          unaTantumCent: 0,
          canoneAnnuoCent: 0,
          canoneMensileCent: 0,
          baseIds,
        })),
      ).map((v) => v.id),
    );
    if (new Set(dati.moduloIds).size !== ammessi.size) {
      throw new Error("Uno o più moduli non sono compatibili con la base scelta");
    }
    moduli = [...perModulo.values()].filter((v) => ammessi.has(v.m.id)).map((v) => v.m);
    if (moduli.some((m) => m.listinoId !== base.b.listinoId))
      throw new Error("I moduli devono appartenere al listino della base");
  }

  const righe: RigaLibera[] = [base.b, ...moduli]
    .flatMap((v) => righeDaVoce(v))
    .map((r) => ({
      descrizione: r.descrizione,
      tipo: r.tipo,
      quantita: 1,
      prezzoUnitarioCent: r.prezzoUnitarioCent,
      scontoBp: r.tipo === "una_tantum" ? dati.scontoUnaTantumBp : 0,
      voceListinoId: r.voceListinoId,
      gruppoAlternativa: r.gruppoAlternativa,
    }));
  return creaPreventivoLibero(db, {
    ragioneSocialeId: rs.id,
    clienteTwentyId: dati.clienteTwentyId,
    righe,
    oggetto: dati.oggetto ?? `${base.b.nome}${moduli.length ? ` + ${moduli.length} moduli` : ""}`,
    note: dati.note,
    validitaGiorni: dati.validitaGiorni,
  });
}

/** Le chiavi di gruppo del client diventano identificativi veri, uno per gruppo. */
function righeDaInput(input: RigaLibera[]) {
  const gruppi = new Map<string, string>();
  return input.map(({ gruppoAlternativa, ...r }, i) => ({
    ...r,
    posizione: i,
    importoCent: importoRiga(r),
    gruppoAlternativaId: gruppoAlternativa
      ? (gruppi.get(gruppoAlternativa) ??
        gruppi.set(gruppoAlternativa, randomUUID()).get(gruppoAlternativa) ??
        null)
      : null,
  }));
}

/**
 * Crea una bozza di preventivo da righe libere: ognuna può venire da un listino o essere scritta
 * a mano, e il listino non è mai obbligatorio. Il totale riguarda le sole righe una tantum.
 */
export async function creaPreventivoLibero(
  db: Database,
  input: CreaPreventivoLiberoInput,
): Promise<{ id: string }> {
  const dati = creaPreventivoLiberoSchema.parse(input);

  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, dati.ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
  if (!rs) throw new Error("Ragione sociale non trovata");

  // Cliente: riferimento locale a Twenty (upsert), la fonte di verità resta Twenty.
  let clienteRefId: string | null = null;
  let clienteSnapshot: Record<string, unknown> = {};
  if (dati.clienteTwentyId) {
    const r = await risolviClienteRef(db, dati.clienteTwentyId);
    clienteRefId = r.id;
    clienteSnapshot = r.cliente;
  }

  const regole: RegoleFiscali = regoleDa(rs);
  const righe = righeDaInput(dati.righe);
  const totali = calcolaTotali(
    righe.filter((r) => r.tipo === "una_tantum"),
    regole,
  );

  const creato = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(preventivi)
      .values({
        ragioneSocialeId: rs.id,
        clienteRefId,
        anno: new Date().getFullYear(),
        stato: "bozza",
        oggetto: dati.oggetto ?? righe[0]?.descrizione.slice(0, 120) ?? "Preventivo",
        note: dati.note || null,
        validoFino: dati.validitaGiorni ? aggiungiGiorni(oggi(), dati.validitaGiorni) : null,
        snapshot: {
          emittente: {
            id: rs.id,
            nome: rs.nome,
            partitaIva: rs.partitaIva,
            codiceFiscale: rs.codiceFiscale,
            indirizzo: rs.indirizzo,
            citta: rs.citta,
          },
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
    if (righe.length > 0)
      await tx.insert(preventivoRighe).values(righe.map((r) => ({ ...r, preventivoId: p.id })));
    return p;
  });
  await emettiEvento(db, "preventivo.creato", { preventivoId: creato.id });
  return creato;
}

/**
 * Riscrive una bozza: emittente, cliente, oggetto, note, validità e righe. Solo la bozza si
 * modifica (dopo l'invio numero, emittente e totali sono congelati). Righe e totali si
 * ricalcolano come alla creazione; la validità conta dalla data di creazione della bozza.
 */
export async function aggiornaPreventivoBozza(
  db: Database,
  id: string,
  input: CreaPreventivoLiberoInput,
): Promise<void> {
  const dati = creaPreventivoLiberoSchema.parse(input);

  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, dati.ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
  if (!rs) throw new Error("Ragione sociale non trovata");

  let clienteRefId: string | null = null;
  let clienteSnapshot: Record<string, unknown> = {};
  if (dati.clienteTwentyId) {
    const r = await risolviClienteRef(db, dati.clienteTwentyId);
    clienteRefId = r.id;
    clienteSnapshot = r.cliente;
  }

  const regole: RegoleFiscali = regoleDa(rs);
  const righe = righeDaInput(dati.righe);
  const totali = calcolaTotali(
    righe.filter((r) => r.tipo === "una_tantum"),
    regole,
  );

  await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)))
      .for("update");
    if (!p) throw new Error("Preventivo non trovato");
    if (p.stato !== "bozza") throw new Error("Si può modificare solo un preventivo in bozza");

    await tx
      .update(preventivi)
      .set({
        ragioneSocialeId: rs.id,
        clienteRefId,
        oggetto: dati.oggetto ?? righe[0]?.descrizione.slice(0, 120) ?? "Preventivo",
        note: dati.note || null,
        validoFino: dati.validitaGiorni
          ? aggiungiGiorni(p.createdAt.toISOString().slice(0, 10), dati.validitaGiorni)
          : null,
        snapshot: {
          emittente: {
            id: rs.id,
            nome: rs.nome,
            partitaIva: rs.partitaIva,
            codiceFiscale: rs.codiceFiscale,
            indirizzo: rs.indirizzo,
            citta: rs.citta,
          },
          cliente: clienteSnapshot,
          regole: { ...regole },
        },
        imponibileCent: totali.imponibileCent,
        ivaCent: totali.ivaCent,
        bolloCent: totali.bolloCent,
        totaleCent: totali.totaleCent,
      })
      .where(eq(preventivi.id, id));
    await tx.delete(preventivoRighe).where(eq(preventivoRighe.preventivoId, id));
    if (righe.length > 0)
      await tx.insert(preventivoRighe).values(righe.map((r) => ({ ...r, preventivoId: id })));
  });
}

/** Si elimina solo una bozza: dopo l'invio il preventivo ha numero e storia, e si rifiuta o scade. */
export async function eliminaPreventivoBozza(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)))
      .for("update");
    if (!p) throw new Error("Preventivo non trovato");
    if (p.stato !== "bozza") throw new Error("Si può eliminare solo un preventivo in bozza");
    await tx.update(preventivi).set({ deletedAt: new Date() }).where(eq(preventivi.id, id));
  });
  return { id, eliminato: true };
}
