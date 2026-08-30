import PDFDocument from "pdfkit";
import { PERIODICITA, TIPI } from "./contratti";

/**
 * PDF del contratto, rigenerato a ogni richiesta dai dati a database.
 *
 * Come per i preventivi, non esiste un file archiviato: il documento riflette
 * sempre lo stato corrente, e i testi sono quelli copiati nel contratto al
 * momento della creazione.
 */

export type DatiContratto = {
  numero: string;
  titolo: string;
  tipo: string;
  emittente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    iban?: string | null;
  };
  cliente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    citta?: string | null;
    referente?: string | null;
  };
  canone: number;
  periodicita: string;
  monteOre?: number | null;
  tariffaExtra?: number | null;
  inizioIl: Date;
  scadeIl?: Date | null;
  rinnovoAutomatico: boolean;
  preavvisoGiorni: number;
  premessa?: string | null;
  oggetto?: string | null;
  condizioniPagamento?: string | null;
  condizioniServizio?: string | null;
  note?: string | null;
};

const NUM = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});
const eur = (v: number) => `€ ${NUM.format(v)}`;
const dataIt = (d: Date) =>
  new Date(d).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

const DESTRA = 539;

export function generaPdfContratto(d: DatiContratto): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const pezzi: Buffer[] = [];
  doc.on("data", (c: Buffer) => pezzi.push(c));
  const finito = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(pezzi))));

  // Registrate esplicitamente: senza, il simbolo dell'euro non viene reso.
  doc.registerFont("corpo", "Helvetica");
  doc.registerFont("grassetto", "Helvetica-Bold");

  // ------------------------------------------------------------ intestazione
  doc.fontSize(18).font("grassetto").text(d.emittente.ragioneSociale);
  doc.moveDown(0.2);
  doc.fontSize(9).font("corpo").fillColor("#666");
  if (d.emittente.partitaIva) doc.text(`P.IVA ${d.emittente.partitaIva}`);
  doc.fillColor("#000");

  doc.moveDown(1.5);
  doc.fontSize(15).font("grassetto").text(`Contratto ${d.numero}`);
  doc.fontSize(11).font("corpo").text(d.titolo);
  doc.fontSize(9).fillColor("#666").text(TIPI[d.tipo] ?? d.tipo);
  doc.fillColor("#000");

  // ------------------------------------------------------------------- parti
  doc.moveDown(1.2);
  const y0 = doc.y;
  doc.fontSize(8).fillColor("#666").text("TRA", 56, y0);
  doc.fontSize(10).fillColor("#000").font("grassetto");
  doc.text(d.emittente.ragioneSociale, 56, doc.y + 2, { width: 230 });
  doc.font("corpo").fontSize(9).fillColor("#444");
  if (d.emittente.partitaIva) doc.text(`P.IVA ${d.emittente.partitaIva}`, { width: 230 });

  doc.fontSize(8).fillColor("#666").text("E", 320, y0);
  doc.fontSize(10).fillColor("#000").font("grassetto");
  doc.text(d.cliente.ragioneSociale, 320, doc.y + 2, { width: 220 });
  doc.font("corpo").fontSize(9).fillColor("#444");
  if (d.cliente.partitaIva) doc.text(`P.IVA ${d.cliente.partitaIva}`, { width: 220 });
  if (d.cliente.citta) doc.text(d.cliente.citta, { width: 220 });
  if (d.cliente.referente) doc.text(`Referente: ${d.cliente.referente}`, { width: 220 });

  doc.x = 56;
  doc.fillColor("#000");
  doc.moveDown(2);

  // Blocco di testo con titoletto, usato per tutte le clausole.
  const sezione = (titolo: string, testo: string) => {
    if (doc.y > 700) doc.addPage();
    doc.fontSize(8).font("grassetto").fillColor("#666").text(titolo.toUpperCase(), 56, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(9.5).font("corpo").fillColor("#000");
    doc.text(testo, 56, doc.y, { width: DESTRA - 56, align: "justify" });
    doc.moveDown(0.8);
  };

  if (d.premessa) sezione("Premessa", d.premessa);
  if (d.oggetto) sezione("Oggetto", d.oggetto);

  // ------------------------------------------------------------- condizioni
  if (doc.y > 620) doc.addPage();
  doc.fontSize(8).font("grassetto").fillColor("#666").text("CORRISPETTIVO E DURATA", 56, doc.y);
  doc.moveDown(0.4);

  const voci: [string, string][] = [
    ["Canone", `${eur(d.canone)} · ${PERIODICITA[d.periodicita] ?? d.periodicita}`],
  ];
  if (d.monteOre) {
    voci.push(["Ore incluse", `${d.monteOre.toLocaleString("it-IT")} h per periodo`]);
    if (d.tariffaExtra) {
      voci.push(["Ore eccedenti", `${eur(d.tariffaExtra)} per ora`]);
    }
  }
  voci.push(["Decorrenza", dataIt(d.inizioIl)]);
  voci.push(["Scadenza", d.scadeIl ? dataIt(d.scadeIl) : "senza termine"]);
  voci.push([
    "Rinnovo",
    d.rinnovoAutomatico
      ? `tacito, salvo disdetta con ${d.preavvisoGiorni} giorni di preavviso`
      : "non automatico",
  ]);

  for (const [k, v] of voci) {
    const y = doc.y;
    doc.fontSize(9).font("corpo").fillColor("#666").text(k, 56, y, { width: 140 });
    doc.fillColor("#000").text(v, 200, y, { width: DESTRA - 200 });
    doc.moveDown(0.35);
  }
  doc.moveDown(0.8);

  if (d.condizioniPagamento) sezione("Condizioni di pagamento", d.condizioniPagamento);
  if (d.condizioniServizio) sezione("Condizioni di servizio", d.condizioniServizio);
  if (d.emittente.iban) sezione("Coordinate bancarie", `IBAN ${d.emittente.iban}`);
  if (d.note) sezione("Note", d.note);

  // ---------------------------------------------------------------- firme
  if (doc.y > 640) doc.addPage();
  doc.moveDown(2);
  const yFirme = doc.y;
  doc.fontSize(8).font("corpo").fillColor("#666");
  doc.text("Il prestatore", 56, yFirme, { width: 200 });
  doc.text("Il committente", 320, yFirme, { width: 200 });
  doc.moveTo(56, yFirme + 42).lineTo(256, yFirme + 42).strokeColor("#999").stroke();
  doc.moveTo(320, yFirme + 42).lineTo(520, yFirme + 42).strokeColor("#999").stroke();
  doc.fontSize(8).fillColor("#888");
  doc.text(d.emittente.ragioneSociale, 56, yFirme + 46, { width: 200 });
  doc.text(d.cliente.ragioneSociale, 320, yFirme + 46, { width: 200 });

  doc.end();
  return finito;
}
