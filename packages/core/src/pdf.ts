import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { z } from "zod";
import { formatAliquota } from "./iva";
import { formatEuro } from "./money";

// Disponibile in Node e nei browser; il pacchetto non include i tipi DOM.
declare function atob(dati: string): string;

/**
 * Generazione dei PDF di preventivi e fatture, e regole di validazione dei modelli.
 * Usa solo i font standard del PDF (nessun file da leggere a runtime): funziona identico
 * nello sviluppo e nell'immagine Docker.
 */

export const COLORE_PREDEFINITO = "#3e63dd";
export const LOGO_PDF_MAX_BYTE = 200_000;

// ── Modello (impostazioni) ───────────────────────────────────────────────────────────────────

const testo = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Al massimo ${max} caratteri`)
    .nullish()
    .transform((v) => v ?? "");

/** Quanto si può personalizzare nei PDF di una ragione sociale. */
export const modelloPdfSchema = z
  .object({
    colore: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido: usa il formato #3e63dd")
      .default(COLORE_PREDEFINITO),
    /** PNG o JPEG come data URL; vuoto = nessun logo */
    logo: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v : null)),
    piePagina: testo(300),
    notePreventivo: testo(1000),
    noteFattura: testo(1000),
    mostraIban: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.logo && !decodificaLogo(v.logo))
      ctx.addIssue({
        code: "custom",
        path: ["logo"],
        message: "Il logo deve essere un'immagine PNG o JPEG fino a 200 KB",
      });
  });
export type ModelloPdf = z.infer<typeof modelloPdfSchema>;

export const MODELLO_PDF_PREDEFINITO: ModelloPdf = {
  colore: COLORE_PREDEFINITO,
  logo: null,
  piePagina: "",
  notePreventivo: "",
  noteFattura: "",
  mostraIban: true,
};

/** Un data URL PNG/JPEG valido e non troppo grande → i byte e il tipo; altrimenti null (WebP escluso: pdf-lib non lo legge). */
export function decodificaLogo(dataUrl: string): { dati: Uint8Array; tipo: "png" | "jpeg" } | null {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m?.[2] || !m[1]) return null;
  let binario: string;
  try {
    binario = atob(m[2]);
  } catch {
    return null;
  }
  if (binario.length === 0 || binario.length > LOGO_PDF_MAX_BYTE) return null;
  const b = (i: number) => binario.charCodeAt(i);
  const tipo = m[1] as "png" | "jpeg";
  const firmaOk =
    tipo === "png"
      ? b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47
      : b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
  if (!firmaOk) return null;
  const dati = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) dati[i] = b(i);
  return { dati, tipo };
}

// ── Dati del documento ───────────────────────────────────────────────────────────────────────

export interface Anagrafica {
  nome: string;
  partitaIva?: string | null;
  codiceFiscale?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  email?: string | null;
  pec?: string | null;
  codiceSdi?: string | null;
  iban?: string | null;
}

export interface RigaPdf {
  descrizione: string;
  /** testo breve accanto alla descrizione, es. «canone annuo» */
  dettaglio?: string | null;
  quantita: number;
  prezzoUnitarioCent: number;
  scontoBp: number;
  importoCent: number;
  /** solo preventivi: separa le prestazioni una tantum dagli abbonamenti */
  tipo?: "una_tantum" | "canone_annuo" | "canone_mensile";
  /** righe con lo stesso valore sono alternative dello stesso servizio (annuale oppure mensile) */
  gruppoId?: string | null;
  /** esito dell'accettazione: nullo = nessuna decisione; falso = esclusa o alternativa non scelta */
  accettata?: boolean | null;
}

/** Totali delle sole prestazioni una tantum accettate, quando il preventivo è stato accettato. */
export interface AccettazionePdf {
  stato: "accettato" | "accettato_parzialmente";
  imponibileCent: number;
  ivaCent: number;
  bolloCent: number;
  totaleCent: number;
  data?: string | null;
}

export interface DatiPdf {
  tipo: "preventivo" | "fattura";
  /** nullo per le bozze: sul documento compare «Bozza» */
  numero: string | null;
  /** data del documento (emissione o creazione), ISO */
  data: string | null;
  /** «valido fino al» per i preventivi, «scadenza» per le fatture, ISO */
  scadenza: string | null;
  oggetto?: string | null;
  note?: string | null;
  emittente: Anagrafica;
  cliente: Anagrafica;
  righe: RigaPdf[];
  imponibileCent: number;
  ivaCent: number;
  bolloCent: number;
  totaleCent: number;
  ritenutaCent?: number;
  ivaSplitCent?: number;
  nettoDaPagareCent?: number;
  ivaAttiva: boolean;
  aliquotaIvaBp: number;
  diciturSenzaIva?: string | null;
  splitPayment?: boolean;
  /** i totali sopra restano quelli dell'offerta originale; questi sono quelli accettati */
  accettazione?: AccettazionePdf | null;
}

// ── Disegno ──────────────────────────────────────────────────────────────────────────────────

const LARGHEZZA = 595.28;
const ALTEZZA = 841.89;
const MARGINE = 48;
const BASSO = 70; // spazio riservato al piè di pagina
// Stessi valori dell'app: testo #202124, secondario #777, filetti #e8e8e8, fondo #f7f8fa.
const GRIGIO = rgb(0.467, 0.467, 0.467);
const NERO = rgb(0.125, 0.129, 0.141);
const LINEA = rgb(0.91, 0.91, 0.91);
const FONDO = rgb(0.969, 0.973, 0.98);
const RAGGIO = 6;
// Rosso dell'app (#b42318) per le righe non accettate.
const ROSSO = rgb(0.706, 0.137, 0.094);

/** Solo caratteri che i font standard sanno disegnare (Latin-1 e €); il resto diventa «?». */
export function perPdf(t: string): string {
  return t
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-")
    .replace(/[   \t]/g, " ")
    .replace(/\r/g, "")
    .replace(/[^\n\x20-\x7e¡-ÿ€]/g, "?");
}

function dataIt(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, g] = iso.slice(0, 10).split("-");
  return a && m && g ? `${g}/${m}/${a}` : iso;
}

function coloreDa(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

class Foglio {
  pagine: PDFPage[] = [];
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly grassetto: PDFFont,
  ) {}

  nuovaPagina() {
    const p = this.doc.addPage([LARGHEZZA, ALTEZZA]);
    this.pagine.push(p);
    this.y = ALTEZZA - MARGINE;
    return p;
  }
  get pagina() {
    return this.pagine[this.pagine.length - 1] as PDFPage;
  }

  larghezza(t: string, dim: number, bold = false) {
    return (bold ? this.grassetto : this.font).widthOfTextAtSize(t, dim);
  }

  /** A capo automatico entro `max` punti; rispetta i ritorni a capo del testo. */
  righe(t: string, dim: number, max: number, bold = false): string[] {
    const out: string[] = [];
    for (const paragrafo of perPdf(t).split("\n")) {
      let corrente = "";
      for (const parola of paragrafo.split(" ")) {
        let p = parola;
        // parola più larga della colonna: si spezza
        while (this.larghezza(p, dim, bold) > max && p.length > 1) {
          let n = p.length - 1;
          while (n > 1 && this.larghezza(p.slice(0, n), dim, bold) > max) n--;
          if (corrente) {
            out.push(corrente);
            corrente = "";
          }
          out.push(p.slice(0, n));
          p = p.slice(n);
        }
        const prova = corrente ? `${corrente} ${p}` : p;
        if (this.larghezza(prova, dim, bold) <= max) corrente = prova;
        else {
          if (corrente) out.push(corrente);
          corrente = p;
        }
      }
      out.push(corrente);
    }
    return out;
  }

  testo(
    t: string,
    x: number,
    y: number,
    dim: number,
    opz: { bold?: boolean; colore?: ReturnType<typeof rgb>; destra?: boolean } = {},
  ) {
    const s = perPdf(t);
    const xx = opz.destra ? x - this.larghezza(s, dim, opz.bold) : x;
    this.pagina.drawText(s, {
      x: xx,
      y,
      size: dim,
      font: opz.bold ? this.grassetto : this.font,
      color: opz.colore ?? NERO,
    });
  }

  /** Blocco di righe a partire da `y`; restituisce la `y` dopo l'ultima. */
  blocco(
    t: string,
    x: number,
    y: number,
    dim: number,
    max: number,
    opz: { bold?: boolean; colore?: ReturnType<typeof rgb>; interlinea?: number } = {},
  ) {
    let yy = y;
    for (const r of this.righe(t, dim, max, opz.bold)) {
      this.testo(r, x, yy - dim, dim, opz);
      yy -= opz.interlinea ?? dim + 3;
    }
    return yy;
  }

  /** Rettangolo con angoli arrotondati; `y` è il bordo alto. */
  riquadro(
    x: number,
    y: number,
    w: number,
    h: number,
    opz: { fondo?: ReturnType<typeof rgb>; bordo?: ReturnType<typeof rgb> } = {},
  ) {
    const r = Math.min(RAGGIO, h / 2, w / 2);
    const percorso = `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    this.pagina.drawSvgPath(percorso, {
      x,
      y,
      color: opz.fondo,
      borderColor: opz.bordo,
      borderWidth: opz.bordo ? 0.75 : 0,
    });
  }

  filetto(x1: number, x2: number, y: number) {
    this.pagina.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.5,
      color: LINEA,
    });
  }

  serve(altezza: number) {
    if (this.y - altezza < BASSO) this.nuovaPagina();
  }
}

function coppieAnagrafica(a: Anagrafica, conSdi: boolean): [string, string][] {
  const luogo =
    [a.cap, a.citta].filter(Boolean).join(" ") + (a.provincia ? ` (${a.provincia})` : "");
  const coppie: [string, string][] = [
    ["Sede", [a.indirizzo, luogo.trim()].filter(Boolean).join(", ")],
    ["P.IVA", a.partitaIva ?? ""],
    ["C.F.", a.codiceFiscale && a.codiceFiscale !== a.partitaIva ? a.codiceFiscale : ""],
    ["PEC", a.pec ?? ""],
    ["Email", !conSdi ? (a.email ?? "") : ""],
    ["Codice SDI", conSdi ? (a.codiceSdi ?? "") : ""],
  ];
  return coppie.filter(([, v]) => v.trim() !== "");
}

/** Genera il PDF di un preventivo o di una fattura. */
export async function generaPdf(dati: DatiPdf, modello: ModelloPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = new Foglio(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );
  const accento = coloreDa(modello.colore);
  const titolo = dati.tipo === "preventivo" ? "Preventivo" : "Fattura";
  const utile = LARGHEZZA - MARGINE * 2;
  f.nuovaPagina();

  // filo d'accento sul bordo alto della pagina
  const accentoPagina = (p: PDFPage) =>
    p.drawRectangle({ x: 0, y: ALTEZZA - 4, width: LARGHEZZA, height: 4, color: accento });
  accentoPagina(f.pagina);

  // intestazione: logo o nome a sinistra, tipo e numero a destra
  let logo: PDFImage | null = null;
  const dl = modello.logo ? decodificaLogo(modello.logo) : null;
  if (dl) {
    try {
      logo = dl.tipo === "png" ? await doc.embedPng(dl.dati) : await doc.embedJpg(dl.dati);
    } catch {
      logo = null; // immagine danneggiata: il documento esce comunque, senza logo
    }
  }
  const yTesta = f.y;
  let fondoLogo = yTesta;
  if (logo) {
    const s = Math.min(150 / logo.width, 48 / logo.height, 1);
    const w = logo.width * s;
    const h = logo.height * s;
    f.pagina.drawImage(logo, { x: MARGINE, y: yTesta - h, width: w, height: h });
    fondoLogo = yTesta - h;
  } else {
    f.testo(dati.emittente.nome, MARGINE, yTesta - 14, 14, { bold: true });
    fondoLogo = yTesta - 18;
  }
  const dX = LARGHEZZA - MARGINE;
  f.testo(titolo, dX, yTesta - 9, 9, { colore: GRIGIO, destra: true });
  if (dati.numero) {
    f.testo(dati.numero, dX, yTesta - 30, 22, { bold: true, destra: true });
  } else {
    const t = "Bozza";
    const wP = f.larghezza(t, 9, true) + 16;
    f.riquadro(dX - wP, yTesta - 14, wP, 20, { fondo: FONDO, bordo: LINEA });
    f.testo(t, dX - wP / 2 - f.larghezza(t, 9, true) / 2, yTesta - 27, 9, {
      bold: true,
      colore: GRIGIO,
    });
  }
  f.y = Math.min(fondoLogo, yTesta - 40) - 18;
  f.filetto(MARGINE, MARGINE + utile, f.y);
  f.y -= 18;

  // oggetto
  if (dati.oggetto) {
    f.y = f.blocco(dati.oggetto, MARGINE, f.y, 12, utile, { bold: true, interlinea: 16 }) - 8;
  }

  // emittente e cliente: due schede con righe etichetta/valore separate da filetti
  const GAP = 14;
  const col = (utile - GAP) / 2;
  const ETICHETTA = 56;
  const PAD = 12;
  const scheda = (titoloScheda: string, a: Anagrafica, conSdi: boolean) => {
    const coppie = coppieAnagrafica(a, conSdi);
    const nomeRighe = f.righe(a.nome || "-", 11, col - PAD * 2, true);
    const righeCoppie = coppie.map(([e, v]) => ({
      e,
      v: f.righe(v, 9, col - PAD * 2 - ETICHETTA),
    }));
    const hRiga = (n: number) => n * 11.5 + 12;
    const altezza =
      PAD +
      12 +
      nomeRighe.length * 14 +
      6 +
      righeCoppie.reduce((s, c) => s + hRiga(c.v.length), 0) +
      4;
    return { titoloScheda, nomeRighe, righeCoppie, hRiga, altezza };
  };
  const sx = scheda("Emittente", dati.emittente, false);
  const dx = scheda("Cliente", dati.cliente, true);
  const hScheda = Math.max(sx.altezza, dx.altezza);
  f.serve(hScheda + 20);
  const yScheda = f.y;
  [
    { s: sx, x: MARGINE },
    { s: dx, x: MARGINE + col + GAP },
  ].forEach(({ s, x }) => {
    f.riquadro(x, yScheda, col, hScheda, { bordo: LINEA });
    f.testo(s.titoloScheda, x + PAD, yScheda - PAD - 7, 8.5, { colore: GRIGIO });
    let yy = yScheda - PAD - 12;
    s.nomeRighe.forEach((r) => {
      f.testo(r, x + PAD, yy - 11, 11, { bold: true });
      yy -= 14;
    });
    yy -= 6;
    for (const c of s.righeCoppie) {
      f.filetto(x + PAD, x + col - PAD, yy);
      c.v.forEach((riga, i) => {
        if (i === 0) f.testo(c.e, x + PAD, yy - 14, 9, { colore: GRIGIO });
        f.testo(riga, x + PAD + ETICHETTA, yy - 14 - i * 11.5, 9);
      });
      yy -= s.hRiga(c.v.length);
    }
  });
  f.y = yScheda - hScheda - 14;

  // data, scadenza e totale in una fascia, come i riepiloghi dell'app
  const strutturato = dati.tipo === "preventivo" && dati.righe.some((r) => r.tipo);
  const acc = dati.accettazione ?? null;
  const celle: [string, string][] = [];
  if (dati.data) celle.push(["Data", dataIt(dati.data)]);
  if (dati.scadenza)
    celle.push([dati.tipo === "preventivo" ? "Valido fino al" : "Scadenza", dataIt(dati.scadenza)]);
  if (acc) celle.push(["Esito", acc.stato === "accettato" ? "Accettato" : "Parziale"]);
  celle.push([
    strutturato ? (acc ? "Totale accettato" : "Totale una tantum") : "Totale",
    formatEuro(acc ? acc.totaleCent : dati.totaleCent),
  ]);
  f.serve(60);
  const hFascia = 42;
  f.riquadro(MARGINE, f.y, utile, hFascia, { bordo: LINEA });
  const wCella = utile / celle.length;
  celle.forEach(([e, v], i) => {
    const x = MARGINE + i * wCella;
    if (i > 0)
      f.pagina.drawLine({
        start: { x, y: f.y - 8 },
        end: { x, y: f.y - hFascia + 8 },
        thickness: 0.5,
        color: LINEA,
      });
    f.testo(e, x + PAD, f.y - 15, 8.5, { colore: GRIGIO });
    f.testo(v, x + PAD, f.y - 31, 12, { bold: true });
  });
  f.y -= hFascia + 20;

  // Una riga è «alternativa non scelta» se un'altra del suo gruppo è stata accettata.
  const scelteGruppo = new Set(
    dati.righe.filter((r) => r.gruppoId && r.accettata === true).map((r) => r.gruppoId),
  );
  const esito = (r: RigaPdf): string | null =>
    r.accettata === false
      ? r.gruppoId && scelteGruppo.has(r.gruppoId)
        ? "Alternativa non scelta"
        : "Non accettata"
      : null;
  /** Testo rosso con una linea al centro: la riga resta leggibile ma chiaramente esclusa. */
  const barrato = (
    t: string,
    x: number,
    y: number,
    dim: number,
    opz: { bold?: boolean; destra?: boolean } = {},
  ) => {
    const s = perPdf(t);
    const larg = f.larghezza(s, dim, opz.bold);
    const x0 = opz.destra ? x - larg : x;
    // x0 è già l'ascissa di partenza: l'allineamento a destra è stato risolto qui sopra.
    f.testo(s, x0, y, dim, { bold: opz.bold, colore: ROSSO });
    f.pagina.drawLine({
      start: { x: x0, y: y + dim * 0.32 },
      end: { x: x0 + larg, y: y + dim * 0.32 },
      thickness: 0.7,
      color: ROSSO,
    });
  };
  const testoRiga = (
    r: RigaPdf,
    t: string,
    x: number,
    y: number,
    dim: number,
    opz: { bold?: boolean; destra?: boolean; colore?: ReturnType<typeof rgb> } = {},
  ) => (r.accettata === false ? barrato(t, x, y, dim, opz) : f.testo(t, x, y, dim, opz));
  const titoloSezione = (t: string) => {
    f.serve(60);
    f.testo(t, MARGINE, f.y - 10, 10.5, { bold: true });
    f.y -= 20;
  };
  const nuovaPaginaConAccento = () => {
    f.nuovaPagina();
    accentoPagina(f.pagina);
  };

  // tabella delle prestazioni: intestazione su fondo chiaro con etichette grigie, righe separate da filetti
  const w = { q: 34, p: 74, s: 46, i: 80 };
  const wDesc = utile - w.q - w.p - w.s - w.i - 16;
  const xQ = MARGINE + wDesc + 8;
  const xP = xQ + w.q;
  const xS = xP + w.p;
  const xI = xS + w.s;
  const intestazioneTabella = () => {
    f.pagina.drawRectangle({ x: MARGINE, y: f.y - 22, width: utile, height: 22, color: FONDO });
    f.filetto(MARGINE, MARGINE + utile, f.y);
    f.filetto(MARGINE, MARGINE + utile, f.y - 22);
    const yy = f.y - 15;
    f.testo("Voce", MARGINE + 8, yy, 8.5, { colore: GRIGIO });
    f.testo("Q.tà", xQ + w.q - 6, yy, 8.5, { colore: GRIGIO, destra: true });
    f.testo("Prezzo", xP + w.p - 6, yy, 8.5, { colore: GRIGIO, destra: true });
    f.testo("Sconto", xS + w.s - 6, yy, 8.5, { colore: GRIGIO, destra: true });
    f.testo("Importo", xI + w.i - 6, yy, 8.5, { colore: GRIGIO, destra: true });
    f.y -= 22;
  };
  const prestazioni = strutturato ? dati.righe.filter((r) => r.tipo === "una_tantum") : dati.righe;
  if (strutturato) titoloSezione("Prestazioni una tantum");
  if (prestazioni.length > 0) {
    intestazioneTabella();
    for (const r of prestazioni) {
      const righe = f.righe(r.descrizione, 9.5, wDesc - 8);
      const nota = esito(r) ?? r.dettaglio ?? null;
      const alt = righe.length * 12.5 + (nota ? 12 : 0) + 14;
      if (f.y - alt < BASSO) {
        nuovaPaginaConAccento();
        intestazioneTabella();
      }
      righe.forEach((riga, i) => testoRiga(r, riga, MARGINE + 8, f.y - 16 - i * 12.5, 9.5));
      if (nota)
        f.testo(nota, MARGINE + 8, f.y - 16 - righe.length * 12.5, 8.5, {
          colore: r.accettata === false ? ROSSO : GRIGIO,
        });
      const yy = f.y - 16;
      testoRiga(r, String(r.quantita), xQ + w.q - 6, yy, 9.5, { destra: true });
      testoRiga(r, formatEuro(r.prezzoUnitarioCent), xP + w.p - 6, yy, 9.5, { destra: true });
      testoRiga(r, r.scontoBp ? formatAliquota(r.scontoBp) : "-", xS + w.s - 6, yy, 9.5, {
        destra: true,
        colore: r.scontoBp ? NERO : GRIGIO,
      });
      testoRiga(r, formatEuro(r.importoCent), xI + w.i - 6, yy, 9.5, { destra: true, bold: true });
      f.y -= alt;
      f.filetto(MARGINE, MARGINE + utile, f.y);
    }
  } else if (strutturato) {
    f.testo("Nessuna prestazione una tantum.", MARGINE, f.y - 10, 9, { colore: GRIGIO });
    f.y -= 18;
  }

  // abbonamenti: una riga per periodicità; le alternative dello stesso servizio sono raggruppate («oppure»)
  const ricorrenti = strutturato ? dati.righe.filter((r) => r.tipo && r.tipo !== "una_tantum") : [];
  if (ricorrenti.length > 0) {
    f.y -= 14;
    titoloSezione("Abbonamenti");
    const wI = 96;
    const wL = dati.ivaAttiva ? 96 : 0;
    const wP = 84;
    const wS = utile - wP - wI - wL - 16;
    const xPer = MARGINE + wS + 8;
    const xImp = xPer + wP;
    const xLor = xImp + wI;
    const intestazioneAbb = () => {
      f.pagina.drawRectangle({ x: MARGINE, y: f.y - 22, width: utile, height: 22, color: FONDO });
      f.filetto(MARGINE, MARGINE + utile, f.y);
      f.filetto(MARGINE, MARGINE + utile, f.y - 22);
      const yy = f.y - 15;
      f.testo("Servizio", MARGINE + 8, yy, 8.5, { colore: GRIGIO });
      f.testo("Periodicità", xPer, yy, 8.5, { colore: GRIGIO });
      f.testo("Importo per periodo", xImp + wI - 6, yy, 8.5, { colore: GRIGIO, destra: true });
      if (dati.ivaAttiva)
        f.testo("IVA inclusa", xLor + wL - 6, yy, 8.5, { colore: GRIGIO, destra: true });
      f.y -= 22;
    };
    intestazioneAbb();
    const viste = new Set<string>();
    let conAlternative = false;
    for (const r of ricorrenti) {
      const inGruppo = !!r.gruppoId;
      if (inGruppo) conAlternative = true;
      const secondo = inGruppo && viste.has(r.gruppoId as string);
      if (inGruppo) viste.add(r.gruppoId as string);
      const nome =
        r.descrizione.replace(/\s*[—-]\s*canone (annuo|mensile)\s*$/i, "").trim() || r.descrizione;
      const righe = f.righe(`${secondo ? "oppure " : ""}${nome}`, 9.5, wS - 8);
      const nota = esito(r);
      const alt = righe.length * 12.5 + (nota ? 12 : 0) + 14;
      if (f.y - alt < BASSO) {
        nuovaPaginaConAccento();
        intestazioneAbb();
      }
      if (inGruppo)
        f.pagina.drawRectangle({
          x: MARGINE,
          y: f.y - alt,
          width: utile,
          height: alt,
          color: FONDO,
        });
      righe.forEach((riga, i) => testoRiga(r, riga, MARGINE + 8, f.y - 16 - i * 12.5, 9.5));
      if (nota) f.testo(nota, MARGINE + 8, f.y - 16 - righe.length * 12.5, 8.5, { colore: ROSSO });
      const yy = f.y - 16;
      testoRiga(r, r.tipo === "canone_annuo" ? "Annuale" : "Mensile", xPer, yy, 9.5);
      const per = r.tipo === "canone_annuo" ? "anno" : "mese";
      testoRiga(r, `${formatEuro(r.importoCent)} / ${per}`, xImp + wI - 6, yy, 9.5, {
        destra: true,
        bold: true,
      });
      if (dati.ivaAttiva) {
        const lordo = r.importoCent + Math.round((r.importoCent * dati.aliquotaIvaBp) / 10000);
        testoRiga(r, `${formatEuro(lordo)} / ${per}`, xLor + wL - 6, yy, 9.5, { destra: true });
      }
      f.y -= alt;
      f.filetto(MARGINE, MARGINE + utile, f.y);
    }
    f.y -= 6;
    const avvisi = [
      conAlternative && !acc
        ? "I servizi indicati con «oppure» sono alternative: il cliente sceglie una sola periodicità."
        : "",
      "Gli abbonamenti non sono compresi nei totali una tantum e non si sommano tra loro.",
    ].filter(Boolean);
    for (const a of avvisi) {
      f.serve(14);
      f.testo(a, MARGINE, f.y - 8, 8, { colore: GRIGIO });
      f.y -= 12;
    }
  }

  // totali in una scheda a destra (con l'accettazione: originale e accettato, mai mescolati)
  const voci: { etichetta: string; valore: string; forte?: boolean; tenue?: boolean }[] = [];
  const t = acc ?? dati;
  if (acc)
    voci.push({
      etichetta: "Imponibile originale",
      valore: formatEuro(dati.imponibileCent),
      tenue: true,
    });
  voci.push({
    etichetta: acc ? "Imponibile accettato" : "Imponibile",
    valore: formatEuro(t.imponibileCent),
  });
  if (dati.ivaAttiva)
    voci.push({
      etichetta: `IVA ${formatAliquota(dati.aliquotaIvaBp)}${dati.splitPayment ? " (split payment)" : ""}`,
      valore: formatEuro(t.ivaCent),
    });
  if (t.bolloCent > 0) voci.push({ etichetta: "Bollo", valore: formatEuro(t.bolloCent) });
  if (!acc && (dati.ritenutaCent ?? 0) > 0)
    voci.push({ etichetta: "Ritenuta d'acconto", valore: formatEuro(-(dati.ritenutaCent ?? 0)) });
  voci.push({
    etichetta: acc ? "Totale accettato" : "Totale",
    valore: formatEuro(t.totaleCent),
    forte: true,
  });
  const netto = dati.nettoDaPagareCent;
  if (!acc && netto !== undefined && netto !== dati.totaleCent)
    voci.push({ etichetta: "Netto da pagare", valore: formatEuro(netto), forte: true });
  const wT = 240;
  const hT = voci.length * 26;
  f.serve(hT + 40);
  f.y -= 16;
  const xT = MARGINE + utile - wT;
  f.riquadro(xT, f.y, wT, hT, { bordo: LINEA });
  voci.forEach((v, i) => {
    const yy = f.y - i * 26;
    if (i > 0) f.filetto(xT + PAD, xT + wT - PAD, yy);
    f.testo(v.etichetta, xT + PAD, yy - 17, v.forte ? 10.5 : 9.5, {
      bold: v.forte,
      colore: v.forte ? NERO : GRIGIO,
    });
    f.testo(v.valore, xT + wT - PAD, yy - 17, v.forte ? 10.5 : 9.5, {
      destra: true,
      bold: v.forte,
      colore: v.forte && /^Totale/.test(v.etichetta) ? accento : v.tenue ? GRIGIO : NERO,
    });
  });
  f.y -= hT;

  // dicitura, note, coordinate
  const chiusura: { titolo: string; testo: string }[] = [];
  if (!dati.ivaAttiva && dati.diciturSenzaIva)
    chiusura.push({ titolo: "Regime fiscale", testo: dati.diciturSenzaIva });
  const noteModello = dati.tipo === "preventivo" ? modello.notePreventivo : modello.noteFattura;
  const note = [dati.note, noteModello].filter((n) => n?.trim()).join("\n\n");
  if (note) chiusura.push({ titolo: "Note", testo: note });
  if (modello.mostraIban && dati.emittente.iban)
    chiusura.push({
      titolo: "Pagamento",
      testo: `Bonifico a ${dati.emittente.nome} - IBAN ${dati.emittente.iban}`,
    });
  f.y -= 22;
  for (const c of chiusura) {
    const righe = f.righe(c.testo, 9, utile);
    f.serve(righe.length * 12 + 30);
    f.testo(c.titolo, MARGINE, f.y - 8, 8.5, { colore: GRIGIO });
    f.y = f.blocco(c.testo, MARGINE, f.y - 14, 9, utile, { interlinea: 12 }) - 12;
  }

  // piè di pagina su ogni pagina
  const n = f.pagine.length;
  f.pagine.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGINE, y: 52 },
      end: { x: LARGHEZZA - MARGINE, y: 52 },
      thickness: 0.5,
      color: LINEA,
    });
    const righe = modello.piePagina ? f.righe(modello.piePagina, 7.5, utile - 70).slice(0, 2) : [];
    righe.forEach((r, k) =>
      p.drawText(r, { x: MARGINE, y: 42 - k * 10, size: 7.5, font: f.font, color: GRIGIO }),
    );
    const pg = `Pagina ${i + 1} di ${n}`;
    p.drawText(pg, {
      x: LARGHEZZA - MARGINE - f.larghezza(pg, 7.5),
      y: 42,
      size: 7.5,
      font: f.font,
      color: GRIGIO,
    });
  });

  doc.setTitle(`${titolo} ${dati.numero ?? "(bozza)"}`);
  doc.setProducer("Telaio");
  doc.setCreator("Telaio");
  return doc.save();
}
