import type { Anagrafica, DatiPdf, RigaPdf } from "@telaio/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { fatturaRighe, fatture, preventivi, preventivoRighe, ragioniSociali } from "./schema";

/** Dati di un documento nel formato che serve al PDF, con il nome del file da proporre. */
export interface DocumentoPdf {
  dati: DatiPdf;
  ragioneSocialeId: string;
  nomeFile: string;
}

type Grezzo = Record<string, unknown> | null | undefined;
const testo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Per ogni campo vale lo snapshot del documento; dove manca si completa con l'anagrafica attuale. */
function anagrafica(snapshot: Grezzo, attuale: Grezzo): Anagrafica {
  const campo = (k: string) => testo(snapshot?.[k]) ?? testo(attuale?.[k]);
  return {
    nome: campo("nome") ?? campo("ragioneSociale") ?? "",
    partitaIva: campo("partitaIva"),
    codiceFiscale: campo("codiceFiscale"),
    indirizzo: campo("indirizzo"),
    cap: campo("cap"),
    citta: campo("citta"),
    provincia: campo("provincia"),
    email: campo("email"),
    pec: campo("pec"),
    codiceSdi: campo("codiceSdi"),
    iban: campo("iban"),
  };
}

function regole(snapshot: Grezzo) {
  const r = (snapshot ?? {}) as Record<string, unknown>;
  return {
    ivaAttiva: r.ivaAttiva !== false,
    aliquotaIvaBp: typeof r.aliquotaIvaBp === "number" ? r.aliquotaIvaBp : 2200,
    diciturSenzaIva: testo(r.diciturSenzaIva),
    splitPayment: r.splitPayment === true,
  };
}

const ETICHETTA_TIPO: Record<string, string | null> = {
  una_tantum: null,
  canone_annuo: "canone annuo",
  canone_mensile: "canone mensile",
};

const nomeSicuro = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

export async function datiPdfPreventivo(db: Database, id: string): Promise<DocumentoPdf | null> {
  const [p] = await db
    .select()
    .from(preventivi)
    .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)));
  if (!p) return null;
  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(eq(ragioniSociali.id, p.ragioneSocialeId));
  const righe = await db
    .select()
    .from(preventivoRighe)
    .where(eq(preventivoRighe.preventivoId, id))
    .orderBy(asc(preventivoRighe.posizione));
  const r = regole(p.snapshot.regole);
  const dati: DatiPdf = {
    tipo: "preventivo",
    numero: p.numero,
    data: p.createdAt.toISOString().slice(0, 10),
    scadenza: p.validoFino,
    oggetto: p.oggetto,
    note: p.note,
    emittente: anagrafica(p.snapshot.emittente, rs),
    cliente: anagrafica(p.snapshot.cliente, null),
    righe: righe.map(
      (x): RigaPdf => ({
        descrizione: x.descrizione,
        dettaglio: ETICHETTA_TIPO[x.tipo] ?? null,
        quantita: x.quantita,
        prezzoUnitarioCent: x.prezzoUnitarioCent,
        scontoBp: x.scontoBp,
        importoCent: x.importoCent,
      }),
    ),
    imponibileCent: p.imponibileCent,
    ivaCent: p.ivaCent,
    bolloCent: p.bolloCent,
    totaleCent: p.totaleCent,
    ...r,
  };
  return {
    dati,
    ragioneSocialeId: p.ragioneSocialeId,
    nomeFile: `Preventivo-${nomeSicuro(p.numero ?? `bozza-${id.slice(0, 8)}`)}.pdf`,
  };
}

export async function datiPdfFattura(db: Database, id: string): Promise<DocumentoPdf | null> {
  const [f] = await db
    .select()
    .from(fatture)
    .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)));
  if (!f) return null;
  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(eq(ragioniSociali.id, f.ragioneSocialeId));
  const righe = await db
    .select()
    .from(fatturaRighe)
    .where(eq(fatturaRighe.fatturaId, id))
    .orderBy(asc(fatturaRighe.posizione));
  const r = regole(f.snapshot.regole);
  const dati: DatiPdf = {
    tipo: "fattura",
    numero: f.numero,
    data: f.dataEmissione,
    scadenza: f.scadenza,
    note: f.note,
    emittente: anagrafica(f.snapshot.emittente, rs),
    cliente: anagrafica(f.snapshot.cliente, null),
    righe: righe.map((x) => ({
      descrizione: x.descrizione,
      quantita: x.quantita,
      prezzoUnitarioCent: x.prezzoUnitarioCent,
      scontoBp: x.scontoBp,
      importoCent: x.importoCent,
    })),
    imponibileCent: f.imponibileCent,
    ivaCent: f.ivaCent,
    bolloCent: f.bolloCent,
    totaleCent: f.totaleCent,
    ritenutaCent: f.ritenutaCent,
    ivaSplitCent: f.ivaSplitCent,
    nettoDaPagareCent: f.nettoDaPagareCent,
    ...r,
  };
  return {
    dati,
    ragioneSocialeId: f.ragioneSocialeId,
    nomeFile: `Fattura-${nomeSicuro(f.numero ?? `bozza-${id.slice(0, 8)}`)}.pdf`,
  };
}

/** Documento di esempio con i dati della ragione sociale: serve all'anteprima dei modelli. */
export async function datiPdfEsempio(
  db: Database,
  ragioneSocialeId: string,
  tipo: "preventivo" | "fattura",
): Promise<DocumentoPdf | null> {
  const [rs] = await db
    .select()
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
  if (!rs) return null;
  const righe: RigaPdf[] = [
    {
      descrizione: "Sito web con pannello di gestione dei contenuti",
      quantita: 1,
      prezzoUnitarioCent: 250000,
      scontoBp: 0,
      importoCent: 250000,
    },
    {
      descrizione: "Hosting, aggiornamenti e assistenza",
      dettaglio: "canone annuo",
      quantita: 1,
      prezzoUnitarioCent: 36000,
      scontoBp: 1000,
      importoCent: 32400,
    },
  ];
  const imponibile = righe.reduce((s, r) => s + r.importoCent, 0);
  const aliquota = rs.ivaAttiva ? rs.aliquotaIvaBp : 0;
  const iva = Math.round((imponibile * aliquota) / 10000);
  const bollo = !rs.ivaAttiva && rs.bolloAutomatico ? 200 : 0;
  const dati: DatiPdf = {
    tipo,
    numero: "ESEMPIO-001",
    data: new Date().toISOString().slice(0, 10),
    scadenza: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    oggetto: tipo === "preventivo" ? "Anteprima del modello" : null,
    note: null,
    emittente: anagrafica(null, rs),
    cliente: {
      nome: "Cliente di esempio S.r.l.",
      partitaIva: "01234567897",
      indirizzo: "Via Esempio 1",
      cap: "20100",
      citta: "Milano",
      provincia: "MI",
      pec: "cliente@pec.esempio.it",
      codiceSdi: "0000000",
    },
    righe,
    imponibileCent: imponibile,
    ivaCent: iva,
    bolloCent: bollo,
    totaleCent: imponibile + iva + bollo,
    ivaAttiva: rs.ivaAttiva,
    aliquotaIvaBp: rs.aliquotaIvaBp,
    diciturSenzaIva: rs.diciturSenzaIva,
    splitPayment: rs.splitPayment,
  };
  return { dati, ragioneSocialeId: rs.id, nomeFile: `Anteprima-${tipo}.pdf` };
}
