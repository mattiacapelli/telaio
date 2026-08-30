import PDFDocument from "pdfkit";
import { calcolaPreventivo, UNITA_BREVE } from "./calcoli";

/**
 * Genera il PDF di un preventivo.
 *
 * Il documento è rigenerato a ogni richiesta dai dati correnti: non esiste un
 * file archiviato che possa divergere dal preventivo dopo una modifica. Per
 * ristampare una versione passata si passano le voci congelate della revisione.
 */

export type DatiPdf = {
  numero: string;
  revisione?: string;
  titolo: string;
  emittente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    iban?: string | null;
  };
  cliente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    citta?: string | null;
  };
  referente?: string | null;
  dataEmissione: Date;
  scadeIl?: Date | null;
  validitaGiorni?: number | null;
  premessa?: string | null;
  tempiConsegna?: string | null;
  modalitaPagamento?: string | null;
  note?: string | null;
  scontoPercento: number;
  aliquotaIva: number;
  voci: {
    descrizione: string;
    nota?: string | null;
    quantita: number;
    unita: string;
    prezzo: number;
    sconto: number;
  }[];
};

const EUR = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});
/* Le font standard PDF rendono l'euro solo con codifica WinAnsi. */
const eur = (v: number) => `\u20AC ${EUR.format(v)}`;
const dataIt = (d: Date) =>
  new Date(d).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

// Colonne della tabella voci, in punti dal margine sinistro.
const COL = { desc: 56, qta: 300, unita: 350, prezzo: 400, sconto: 462, tot: 500 };
const DESTRA = 539; // margine destro utile

export function generaPdfPreventivo(d: DatiPdf): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  // Registrate esplicitamente: senza, il simbolo dell'euro non viene reso.
  doc.registerFont("corpo", "Helvetica");
  doc.registerFont("grassetto", "Helvetica-Bold");
  const pezzi: Buffer[] = [];
  doc.on("data", (c: Buffer) => pezzi.push(c));

  const finito = new Promise<Buffer>((risolvi) => {
    doc.on("end", () => risolvi(Buffer.concat(pezzi)));
  });

  const riepilogo = calcolaPreventivo(d.voci, d.scontoPercento, d.aliquotaIva);

  // ---------------------------------------------------------- intestazione
  doc.fontSize(18).font("Helvetica-Bold").text(d.emittente.ragioneSociale);
  doc.moveDown(0.2);
  doc.fontSize(9).font("Helvetica").fillColor("#666");
  if (d.emittente.partitaIva) doc.text(`P.IVA ${d.emittente.partitaIva}`);
  doc.fillColor("#000");

  doc.moveDown(1.5);
  doc.fontSize(15).font("Helvetica-Bold");
  doc.text(`Preventivo ${d.numero}${d.revisione ? ` · ${d.revisione}` : ""}`);
  doc.fontSize(11).font("Helvetica").text(d.titolo);

  // ------------------------------------------------------ destinatario
  doc.moveDown(1.2);
  const yBlocchi = doc.y;
  doc.fontSize(8).fillColor("#666").text("DESTINATARIO", 56, yBlocchi);
  doc.fontSize(10).fillColor("#000").font("Helvetica-Bold");
  doc.text(d.cliente.ragioneSociale, 56, doc.y + 2, { width: 240 });
  doc.font("corpo").fontSize(9).fillColor("#444");
  if (d.cliente.partitaIva) doc.text(`P.IVA ${d.cliente.partitaIva}`, { width: 240 });
  if (d.cliente.citta) doc.text(d.cliente.citta, { width: 240 });
  if (d.referente) doc.text(`Alla c.a. ${d.referente}`, { width: 240 });

  // Colonna destra: date e validità, allineate all'inizio del blocco.
  doc.fontSize(8).fillColor("#666").text("DATA", 340, yBlocchi);
  doc.fontSize(10).fillColor("#000").text(dataIt(d.dataEmissione), 340, doc.y + 2);
  if (d.scadeIl) {
    doc.fontSize(8).fillColor("#666").text("VALIDA FINO AL", 340, doc.y + 6);
    doc.fontSize(10).fillColor("#000").text(dataIt(d.scadeIl), 340, doc.y + 2);
  } else if (d.validitaGiorni) {
    doc.fontSize(8).fillColor("#666").text("VALIDITÀ", 340, doc.y + 6);
    doc.fontSize(10).fillColor("#000").text(`${d.validitaGiorni} giorni`, 340, doc.y + 2);
  }

  doc.x = 56;
  doc.moveDown(2);

  if (d.premessa) {
    doc.fontSize(9).fillColor("#333").font("Helvetica");
    doc.text(d.premessa, 56, doc.y, { width: DESTRA - 56, align: "justify" });
    doc.moveDown(1);
  }

  // ------------------------------------------------------------- tabella
  const intestazione = (y: number) => {
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#666");
    doc.text("DESCRIZIONE", COL.desc, y);
    doc.text("Q.TÀ", COL.qta, y, { width: 40, align: "right" });
    doc.text("U.M.", COL.unita, y, { width: 40 });
    doc.text("PREZZO", COL.prezzo, y, { width: 55, align: "right" });
    doc.text("SC.", COL.sconto, y, { width: 30, align: "right" });
    doc.text("TOTALE", COL.tot, y, { width: 39, align: "right" });
    doc.moveTo(56, y + 12).lineTo(DESTRA, y + 12).strokeColor("#ddd").stroke();
    return y + 18;
  };

  let y = intestazione(doc.y);
  doc.font("corpo").fillColor("#000");

  for (const v of d.voci) {
    // Cambio pagina prima di scrivere una riga che non entrerebbe.
    if (y > 700) {
      doc.addPage();
      y = intestazione(56);
      doc.font("corpo").fillColor("#000");
    }

    const totale = v.quantita * v.prezzo * (1 - (v.sconto || 0) / 100);
    doc.fontSize(9.5);
    const altezza = doc.heightOfString(v.descrizione, { width: 230 });
    doc.text(v.descrizione, COL.desc, y, { width: 230 });
    doc.text(String(v.quantita).replace(".", ","), COL.qta, y, { width: 40, align: "right" });
    doc.text(UNITA_BREVE[v.unita] ?? "", COL.unita, y, { width: 40 });
    doc.text(EUR.format(v.prezzo), COL.prezzo, y, { width: 55, align: "right" });
    doc.text(v.sconto ? `${v.sconto}%` : "—", COL.sconto, y, { width: 30, align: "right" });
    doc.text(EUR.format(totale), COL.tot, y, { width: 39, align: "right" });

    y += Math.max(altezza, 12) + 2;
    if (v.nota) {
      doc.fontSize(8).fillColor("#777");
      doc.text(v.nota, COL.desc, y, { width: 230 });
      y += doc.heightOfString(v.nota, { width: 230 }) + 2;
      doc.fillColor("#000");
    }
    y += 4;
  }

  // ------------------------------------------------------------ riepilogo
  doc.moveTo(56, y).lineTo(DESTRA, y).strokeColor("#ddd").stroke();
  y += 10;

  const riga = (etichetta: string, valore: string, grassetto = false) => {
    doc.fontSize(grassetto ? 11 : 9.5);
    doc.font(grassetto ? "grassetto" : "corpo");
    doc.fillColor(grassetto ? "#000" : "#444");
    doc.text(etichetta, 340, y, { width: 100, align: "right" });
    doc.text(valore, 440, y, { width: 99, align: "right" });
    y += grassetto ? 18 : 14;
  };

  if (riepilogo.scontiRiga > 0) riga("Sconti di riga", `− ${EUR.format(riepilogo.scontiRiga)}`);
  if (riepilogo.scontoTotale > 0)
    riga(`Sconto ${d.scontoPercento}%`, `− ${EUR.format(riepilogo.scontoTotale)}`);
  riga("Imponibile", EUR.format(riepilogo.imponibile));
  riga(`IVA ${d.aliquotaIva}%`, EUR.format(riepilogo.iva));
  y += 2;
  doc.moveTo(340, y).lineTo(DESTRA, y).strokeColor("#ccc").stroke();
  y += 8;
  riga("TOTALE", eur(riepilogo.totale), true);

  // ----------------------------------------------------------- condizioni
  const condizioni: [string, string][] = [];
  if (d.tempiConsegna) condizioni.push(["Tempi di consegna", d.tempiConsegna]);
  if (d.modalitaPagamento) condizioni.push(["Modalità di pagamento", d.modalitaPagamento]);
  if (d.emittente.iban) condizioni.push(["IBAN", d.emittente.iban]);
  if (d.note) condizioni.push(["Note", d.note]);

  if (condizioni.length) {
    y += 16;
    if (y > 680) {
      doc.addPage();
      y = 56;
    }
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#666").text("CONDIZIONI", 56, y);
    y += 14;
    for (const [k, v] of condizioni) {
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#444").text(k, 56, y);
      y += 11;
      doc.fontSize(9).font("Helvetica").fillColor("#000");
      doc.text(v, 56, y, { width: DESTRA - 56 });
      y += doc.heightOfString(v, { width: DESTRA - 56 }) + 8;
    }
  }

  doc.end();
  return finito;
}
