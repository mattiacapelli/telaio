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
}

// ── Disegno ──────────────────────────────────────────────────────────────────────────────────

const LARGHEZZA = 595.28;
const ALTEZZA = 841.89;
const MARGINE = 48;
const BASSO = 70; // spazio riservato al piè di pagina
const GRIGIO = rgb(0.45, 0.45, 0.47);
const NERO = rgb(0.125, 0.129, 0.141);
const LINEA = rgb(0.9, 0.9, 0.91);

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

  serve(altezza: number) {
    if (this.y - altezza < BASSO) this.nuovaPagina();
  }
}

function righeAnagrafica(a: Anagrafica, conSdi: boolean): string[] {
  const luogo =
    [a.cap, a.citta].filter(Boolean).join(" ") + (a.provincia ? ` (${a.provincia})` : "");
  return [
    a.indirizzo ?? "",
    luogo.trim(),
    a.partitaIva ? `P.IVA ${a.partitaIva}` : "",
    a.codiceFiscale && a.codiceFiscale !== a.partitaIva ? `C.F. ${a.codiceFiscale}` : "",
    a.pec ? `PEC ${a.pec}` : "",
    !conSdi && a.email ? a.email : "",
    conSdi && a.codiceSdi ? `Codice SDI ${a.codiceSdi}` : "",
  ].filter((r) => r.trim() !== "");
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

  // intestazione: logo a sinistra, titolo e numero a destra
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
    const s = Math.min(150 / logo.width, 56 / logo.height, 1);
    const w = logo.width * s;
    const h = logo.height * s;
    f.pagina.drawImage(logo, { x: MARGINE, y: yTesta - h, width: w, height: h });
    fondoLogo = yTesta - h;
  } else {
    f.testo(dati.emittente.nome, MARGINE, yTesta - 16, 16, { bold: true });
    fondoLogo = yTesta - 20;
  }
  f.testo(titolo.toUpperCase(), LARGHEZZA - MARGINE, yTesta - 18, 20, {
    bold: true,
    colore: accento,
    destra: true,
  });
  f.testo(dati.numero ? `N. ${dati.numero}` : "Bozza", LARGHEZZA - MARGINE, yTesta - 36, 11, {
    destra: true,
  });
  if (dati.data)
    f.testo(`Data ${dataIt(dati.data)}`, LARGHEZZA - MARGINE, yTesta - 50, 9, {
      colore: GRIGIO,
      destra: true,
    });
  f.y = Math.min(fondoLogo, yTesta - 56) - 28;

  // emittente e cliente affiancati
  const col = (utile - 28) / 2;
  const yBlocchi = f.y;
  f.testo("DA", MARGINE, yBlocchi - 8, 7.5, { bold: true, colore: GRIGIO });
  f.testo("PER", MARGINE + col + 28, yBlocchi - 8, 7.5, { bold: true, colore: GRIGIO });
  let ySx = f.blocco(dati.emittente.nome, MARGINE, yBlocchi - 14, 10, col, { bold: true });
  ySx = f.blocco(righeAnagrafica(dati.emittente, false).join("\n"), MARGINE, ySx, 9, col, {
    colore: GRIGIO,
  });
  let yDx = f.blocco(dati.cliente.nome || "-", MARGINE + col + 28, yBlocchi - 14, 10, col, {
    bold: true,
  });
  yDx = f.blocco(righeAnagrafica(dati.cliente, true).join("\n"), MARGINE + col + 28, yDx, 9, col, {
    colore: GRIGIO,
  });
  f.y = Math.min(ySx, yDx) - 18;

  // oggetto e scadenza
  const meta: string[] = [];
  if (dati.scadenza)
    meta.push(
      `${dati.tipo === "preventivo" ? "Valido fino al" : "Scadenza"} ${dataIt(dati.scadenza)}`,
    );
  if (dati.oggetto) {
    f.y = f.blocco(`Oggetto: ${dati.oggetto}`, MARGINE, f.y, 10.5, utile, { bold: true }) - 2;
  }
  if (meta.length) f.y = f.blocco(meta.join("   "), MARGINE, f.y, 9, utile, { colore: GRIGIO }) - 2;
  f.y -= 12;

  // tabella
  const w = { q: 34, p: 72, s: 46, i: 76 };
  const wDesc = utile - w.q - w.p - w.s - w.i - 16;
  const xQ = MARGINE + wDesc + 8;
  const xP = xQ + w.q;
  const xS = xP + w.p;
  const xI = xS + w.s;
  const intestazioneTabella = () => {
    f.pagina.drawRectangle({ x: MARGINE, y: f.y - 20, width: utile, height: 20, color: accento });
    const yy = f.y - 14;
    const bianco = rgb(1, 1, 1);
    f.testo("Descrizione", MARGINE + 8, yy, 8.5, { bold: true, colore: bianco });
    f.testo("Q.tà", xQ + w.q - 6, yy, 8.5, { bold: true, colore: bianco, destra: true });
    f.testo("Prezzo", xP + w.p - 6, yy, 8.5, { bold: true, colore: bianco, destra: true });
    f.testo("Sconto", xS + w.s - 6, yy, 8.5, { bold: true, colore: bianco, destra: true });
    f.testo("Importo", xI + w.i - 6, yy, 8.5, { bold: true, colore: bianco, destra: true });
    f.y -= 20;
  };
  intestazioneTabella();
  for (const r of dati.righe) {
    const desc = r.dettaglio ? `${r.descrizione} (${r.dettaglio})` : r.descrizione;
    const righe = f.righe(desc, 9.5, wDesc - 8);
    const alt = righe.length * 12.5 + 10;
    if (f.y - alt < BASSO) {
      f.nuovaPagina();
      intestazioneTabella();
    }
    righe.forEach((riga, i) => f.testo(riga, MARGINE + 8, f.y - 15 - i * 12.5, 9.5));
    const yy = f.y - 15;
    f.testo(String(r.quantita), xQ + w.q - 6, yy, 9.5, { destra: true });
    f.testo(formatEuro(r.prezzoUnitarioCent), xP + w.p - 6, yy, 9.5, { destra: true });
    f.testo(r.scontoBp ? formatAliquota(r.scontoBp) : "-", xS + w.s - 6, yy, 9.5, {
      destra: true,
      colore: r.scontoBp ? NERO : GRIGIO,
    });
    f.testo(formatEuro(r.importoCent), xI + w.i - 6, yy, 9.5, { destra: true, bold: true });
    f.y -= alt;
    f.pagina.drawLine({
      start: { x: MARGINE, y: f.y },
      end: { x: MARGINE + utile, y: f.y },
      thickness: 0.5,
      color: LINEA,
    });
  }

  // totali
  const voci: { etichetta: string; valore: string; forte?: boolean }[] = [
    { etichetta: "Imponibile", valore: formatEuro(dati.imponibileCent) },
  ];
  if (dati.ivaAttiva)
    voci.push({
      etichetta: `IVA ${formatAliquota(dati.aliquotaIvaBp)}${dati.splitPayment ? " (split payment)" : ""}`,
      valore: formatEuro(dati.ivaCent),
    });
  if (dati.bolloCent > 0) voci.push({ etichetta: "Bollo", valore: formatEuro(dati.bolloCent) });
  if ((dati.ritenutaCent ?? 0) > 0)
    voci.push({ etichetta: "Ritenuta d'acconto", valore: formatEuro(-(dati.ritenutaCent ?? 0)) });
  voci.push({ etichetta: "Totale", valore: formatEuro(dati.totaleCent), forte: true });
  const netto = dati.nettoDaPagareCent;
  if (netto !== undefined && netto !== dati.totaleCent)
    voci.push({ etichetta: "Netto da pagare", valore: formatEuro(netto), forte: true });
  f.serve(voci.length * 18 + 30);
  f.y -= 14;
  const xT = MARGINE + utile - 230;
  for (const v of voci) {
    if (v.forte) {
      f.pagina.drawLine({
        start: { x: xT, y: f.y + 4 },
        end: { x: MARGINE + utile, y: f.y + 4 },
        thickness: 1,
        color: accento,
      });
      f.y -= 4;
    }
    f.testo(v.etichetta, xT, f.y - 10, v.forte ? 11 : 9.5, {
      bold: v.forte,
      colore: v.forte ? NERO : GRIGIO,
    });
    f.testo(v.valore, MARGINE + utile, f.y - 10, v.forte ? 11 : 9.5, {
      destra: true,
      bold: v.forte,
    });
    f.y -= 18;
  }

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
  f.y -= 10;
  for (const c of chiusura) {
    const righe = f.righe(c.testo, 9, utile);
    f.serve(righe.length * 12 + 26);
    f.testo(c.titolo.toUpperCase(), MARGINE, f.y - 8, 7.5, { bold: true, colore: GRIGIO });
    f.y = f.blocco(c.testo, MARGINE, f.y - 14, 9, utile, { interlinea: 12 }) - 10;
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
