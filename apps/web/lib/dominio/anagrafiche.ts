import { formatoValido } from "@telaio/core";
import {
  and,
  conti,
  type Database,
  eq,
  inArray,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
} from "@telaio/db";
import { z } from "zod";

/**
 * Anagrafiche e configurazione commerciale: ragioni sociali, regole fiscali, conti, listini e le
 * loro voci. Le usa il server MCP; hanno le stesse regole dei form di Impostazioni.
 */

const testo = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Al massimo ${max} caratteri`)
    .nullish()
    .transform((v) => v || null);

const formato = z.string().trim().refine(formatoValido, "Serve almeno un token {N} o {NNN}");

export const TIPI_RAGIONE_SOCIALE = ["ditta_individuale", "srl", "associazione", "altro"] as const;

// I campi stanno senza valori di default: servono alla creazione, ma una modifica parziale non
// deve riscrivere ciò che non è stato indicato (con `.partial()` Zod applicherebbe i default).
const ragioneSocialeCampi = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  tipo: z.enum(TIPI_RAGIONE_SOCIALE),
  partitaIva: testo(30),
  codiceFiscale: testo(30),
  indirizzo: testo(200),
  cap: testo(10),
  citta: testo(100),
  provincia: testo(10),
  email: testo(254),
  pec: testo(254),
  codiceSdi: testo(10),
  iban: testo(40),
  formatoPreventivo: formato,
  formatoFattura: formato,
});

export const ragioneSocialeSchema = ragioneSocialeCampi.extend({
  tipo: ragioneSocialeCampi.shape.tipo.default("ditta_individuale"),
  formatoPreventivo: formato.default("P-{AAAA}-{NNN}"),
  formatoFattura: formato.default("F-{AAAA}-{NNN}"),
});
export const ragioneSocialeModificaSchema = ragioneSocialeCampi.partial();

const soloDefiniti = <T extends Record<string, unknown>>(v: T) =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Partial<T>;

export async function creaRagioneSociale(db: Database, input: unknown): Promise<{ id: string }> {
  const dati = ragioneSocialeSchema.parse(input);
  const [r] = await db.insert(ragioniSociali).values(dati).returning({ id: ragioniSociali.id });
  if (!r) throw new Error("Creazione della ragione sociale non riuscita");
  return r;
}

async function ragioneSocialeAttiva(db: Pick<Database, "select">, id: string) {
  const [r] = await db
    .select()
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, id), isNull(ragioniSociali.deletedAt)));
  if (!r) throw new Error("Ragione sociale non trovata");
  return r;
}

/** Cambia solo i campi indicati; un campo a `null` si svuota. Le regole fiscali hanno un loro strumento. */
export async function modificaRagioneSociale(db: Database, id: string, input: unknown) {
  const dati = soloDefiniti(ragioneSocialeModificaSchema.parse(input));
  await ragioneSocialeAttiva(db, id);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  await db.update(ragioniSociali).set(dati).where(eq(ragioniSociali.id, id));
  return { id };
}

/** Non si cancella: l'emittente resta nei documenti già emessi. */
export async function archiviaRagioneSociale(db: Database, id: string) {
  await ragioneSocialeAttiva(db, id);
  await db.update(ragioniSociali).set({ deletedAt: new Date() }).where(eq(ragioniSociali.id, id));
  return { id, archiviata: true };
}

export const regoleFiscaliSchema = z.object({
  ivaAttiva: z.boolean(),
  /** aliquota in punti base: 2200 = 22% */
  aliquotaIvaBp: z.number().int().min(0).max(10000),
  naturaSenzaIva: testo(20),
  diciturSenzaIva: testo(500),
  bolloAutomatico: z.boolean(),
  /** ritenuta d'acconto in punti base; vuoto o 0 = nessuna */
  ritenutaBp: z.number().int().min(0).max(10000).nullish(),
  splitPayment: z.boolean(),
  contoPredefinitoId: z.uuid().nullish(),
});

/** Come il form delle regole: senza IVA servono natura e dicitura di legge. I campi non indicati restano come sono. */
export async function modificaRegoleFiscali(db: Database, id: string, input: unknown) {
  const patch = soloDefiniti(regoleFiscaliSchema.partial().parse(input));
  const att = await ragioneSocialeAttiva(db, id);
  const v = regoleFiscaliSchema.parse({
    ivaAttiva: att.ivaAttiva,
    aliquotaIvaBp: att.aliquotaIvaBp,
    naturaSenzaIva: att.naturaSenzaIva,
    diciturSenzaIva: att.diciturSenzaIva,
    bolloAutomatico: att.bolloAutomatico,
    ritenutaBp: att.ritenutaBp,
    splitPayment: att.splitPayment,
    contoPredefinitoId: att.contoPredefinitoId,
    ...patch,
  });
  if (!v.ivaAttiva && !v.naturaSenzaIva)
    throw new Error("Senza IVA indica la natura (es. N2.2, N4)");
  if (!v.ivaAttiva && !v.diciturSenzaIva) throw new Error("Senza IVA indica la dicitura di legge");
  if (v.contoPredefinitoId) await contoAttivo(db, v.contoPredefinitoId);
  await db
    .update(ragioniSociali)
    .set({
      ivaAttiva: v.ivaAttiva,
      aliquotaIvaBp: v.ivaAttiva ? v.aliquotaIvaBp : 0,
      naturaSenzaIva: v.ivaAttiva ? null : v.naturaSenzaIva,
      diciturSenzaIva: v.ivaAttiva ? null : v.diciturSenzaIva,
      bolloAutomatico: v.ivaAttiva ? false : v.bolloAutomatico,
      ritenutaBp: v.ritenutaBp && v.ritenutaBp > 0 ? v.ritenutaBp : null,
      splitPayment: v.splitPayment,
      contoPredefinitoId: v.contoPredefinitoId ?? null,
    })
    .where(eq(ragioniSociali.id, id));
  return { id };
}

// ── Conti ────────────────────────────────────────────────────────────────────────────────────

async function contoAttivo(db: Pick<Database, "select">, id: string) {
  const [c] = await db
    .select()
    .from(conti)
    .where(and(eq(conti.id, id), isNull(conti.deletedAt)));
  if (!c) throw new Error("Conto non trovato");
  return c;
}

export const contoModificaSchema = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  tipo: z.enum(["bonifico", "contante", "carta"]),
  ragioneSocialeId: z.uuid().nullish(),
  iban: testo(40),
  saldoInizialeCent: z.number().int(),
  attivo: z.boolean(),
});

export async function modificaConto(db: Database, id: string, input: unknown) {
  const dati = soloDefiniti(contoModificaSchema.partial().parse(input));
  await contoAttivo(db, id);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  if (dati.ragioneSocialeId) await ragioneSocialeAttiva(db, dati.ragioneSocialeId);
  await db.update(conti).set(dati).where(eq(conti.id, id));
  return { id };
}

/** I movimenti e gli incassi del conto restano: il conto sparisce solo dagli elenchi. */
export async function archiviaConto(db: Database, id: string) {
  await contoAttivo(db, id);
  await db.update(conti).set({ deletedAt: new Date() }).where(eq(conti.id, id));
  // un conto archiviato non può restare il predefinito di nessuna ragione sociale
  await db
    .update(ragioniSociali)
    .set({ contoPredefinitoId: null })
    .where(eq(ragioniSociali.contoPredefinitoId, id));
  return { id, archiviato: true };
}

// ── Listini ──────────────────────────────────────────────────────────────────────────────────

const listinoCampi = z.object({
  ragioneSocialeId: z.uuid(),
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  descrizione: testo(500),
  attivo: z.boolean(),
});
export const listinoSchema = listinoCampi.extend({ attivo: z.boolean().default(true) });
export const listinoModificaSchema = listinoCampi.partial();

export async function creaListino(db: Database, input: unknown): Promise<{ id: string }> {
  const dati = listinoSchema.parse(input);
  await ragioneSocialeAttiva(db, dati.ragioneSocialeId);
  const [l] = await db.insert(listini).values(dati).returning({ id: listini.id });
  if (!l) throw new Error("Creazione del listino non riuscita");
  return l;
}

async function listinoAttivo(db: Pick<Database, "select">, id: string) {
  const [l] = await db
    .select()
    .from(listini)
    .where(and(eq(listini.id, id), isNull(listini.deletedAt)));
  if (!l) throw new Error("Listino non trovato");
  return l;
}

/** L'emittente di un listino non si cambia: i preventivi già fatti con quel listino lo hanno come riferimento. */
export async function modificaListino(db: Database, id: string, input: unknown) {
  const { ragioneSocialeId: _, ...dati } = soloDefiniti(listinoModificaSchema.parse(input));
  await listinoAttivo(db, id);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  await db.update(listini).set(dati).where(eq(listini.id, id));
  return { id };
}

/** Archivia il listino con le sue voci: i preventivi esistenti non cambiano. */
export async function archiviaListino(db: Database, id: string) {
  await listinoAttivo(db, id);
  const ora = new Date();
  await db.transaction(async (tx) => {
    await tx.update(listini).set({ deletedAt: ora }).where(eq(listini.id, id));
    await tx
      .update(listinoBasi)
      .set({ deletedAt: ora })
      .where(and(eq(listinoBasi.listinoId, id), isNull(listinoBasi.deletedAt)));
    await tx
      .update(listinoModuli)
      .set({ deletedAt: ora })
      .where(and(eq(listinoModuli.listinoId, id), isNull(listinoModuli.deletedAt)));
  });
  return { id, archiviato: true };
}

const prezzo = z.number().int().min(0).max(1_000_000_00);

const voceCampi = z.object({
  listinoId: z.uuid(),
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  descrizione: testo(500),
  unaTantumCent: prezzo,
  canoneAnnuoCent: prezzo,
  canoneMensileCent: prezzo,
  ordine: z.number().int().min(0),
  attivo: z.boolean(),
});
export const voceListinoSchema = voceCampi.extend({
  unaTantumCent: prezzo.default(0),
  canoneAnnuoCent: prezzo.default(0),
  canoneMensileCent: prezzo.default(0),
  ordine: z.number().int().min(0).optional(),
  attivo: z.boolean().default(true),
});
export const voceListinoModificaSchema = voceCampi.partial();

export type TipoVoce = "base" | "modulo";
const tabella = (tipo: TipoVoce) => (tipo === "base" ? listinoBasi : listinoModuli);

/** Imposta le basi a cui un modulo è assegnabile: solo basi dello stesso listino, non archiviate. */
async function assegnaBasi(db: Database, moduloId: string, listinoId: string, baseIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(moduloBasi).where(eq(moduloBasi.moduloId, moduloId));
    if (baseIds.length === 0) return;
    const valide = await tx
      .select({ id: listinoBasi.id })
      .from(listinoBasi)
      .where(
        and(
          eq(listinoBasi.listinoId, listinoId),
          isNull(listinoBasi.deletedAt),
          inArray(listinoBasi.id, baseIds),
        ),
      );
    if (valide.length !== new Set(baseIds).size)
      throw new Error("Una o più basi non appartengono a questo listino");
    await tx.insert(moduloBasi).values(valide.map((b) => ({ moduloId, baseId: b.id })));
  });
}

export async function creaVoceListino(
  db: Database,
  tipo: TipoVoce,
  input: unknown,
  baseIds: string[] = [],
): Promise<{ id: string }> {
  const dati = voceListinoSchema.parse(input);
  await listinoAttivo(db, dati.listinoId);
  const [v] = await db
    .insert(tabella(tipo))
    .values(dati)
    .returning({ id: tabella(tipo).id });
  if (!v) throw new Error("Creazione della voce non riuscita");
  if (tipo === "modulo" && baseIds.length > 0) await assegnaBasi(db, v.id, dati.listinoId, baseIds);
  return v;
}

export async function modificaVoceListino(
  db: Database,
  tipo: TipoVoce,
  id: string,
  input: unknown,
  baseIds?: string[],
) {
  const { listinoId: _, ...dati } = soloDefiniti(voceListinoModificaSchema.parse(input));
  const t = tabella(tipo);
  const [att] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), isNull(t.deletedAt)));
  if (!att) throw new Error("Voce non trovata");
  if (Object.keys(dati).length === 0 && baseIds === undefined)
    throw new Error("Nessun campo da modificare");
  if (Object.keys(dati).length > 0) await db.update(t).set(dati).where(eq(t.id, id));
  if (tipo === "modulo" && baseIds !== undefined) await assegnaBasi(db, id, att.listinoId, baseIds);
  return { id };
}

export async function archiviaVoceListino(db: Database, tipo: TipoVoce, id: string) {
  const t = tabella(tipo);
  const r = await db
    .update(t)
    .set({ deletedAt: new Date() })
    .where(and(eq(t.id, id), isNull(t.deletedAt)))
    .returning({ id: t.id });
  if (r.length === 0) throw new Error("Voce non trovata");
  return { id, archiviata: true };
}
