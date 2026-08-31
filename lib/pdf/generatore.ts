import PDFDocument from "pdfkit";
import type { BloccoPdf, StilePdf } from "./blocchi";
import { STILE_PREDEFINITO } from "./blocchi";

/**
 * Genera un PDF percorrendo i blocchi del modello.
 *
 * Ogni blocco riceve il documento e i dati, disegna la sua parte e lascia il
 * cursore pronto per il successivo. Così l'ordine dei blocchi nel modello è
 * l'ordine di stampa, e aggiungerne uno nuovo non tocca gli altri.
 */

export type DatiDocumento = {
  numero: string;
  revisione?: string;
  titolo: string;
  tipo?: string;
  emittente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    codiceFiscale?: string | null;
    iban?: string | null;
    regimeFiscale?: string | null;
    indirizzo?: string | null;
    citta?: string | null;
    cap?: string | null;
    provincia?: string | null;
    telefono?: string | null;
    email?: string | null;
    pec?: string | null;
    sitoWeb?: string | null;
    /** Buffer PNG/JPEG del logo, già scaricato dallo storage. */
    logo?: Buffer | null;
  };
  /** Marca da bollo: se l'imponibile supera la soglia, il documento lo segnala. */
  bollo?: { soglia: number; importo: number } | null;
  cliente: {
    ragioneSociale: string;
    partitaIva?: string | null;
    citta?: string | null;
    referente?: string | null;
  };
  dataEmissione: Date;
  scadeIl?: Date | null;
  validitaGiorni?: number | null;
  /** Testi liberi, indirizzati dai blocchi "testo" tramite la chiave campo. */
  testi: Record<string, string | null | undefined>;
  /** Voci del preventivo. */
  voci?: {
    descrizione: string;
    nota?: string | null;
    quantita: number;
    unita: string;
    prezzo: number;
    sconto: number;
  }[];
  riepilogo?: {
    scontiRiga: number;
    scontoTotale: number;
    imponibile: number;
    iva: number;
    totale: number;
  };
  scontoPercento?: number;
  aliquotaIva?: number;
  /** Dati del contratto. */
  contratto?: {
    canone: number;
    periodicita: string;
    monteOre?: number | null;
    tariffaExtra?: number | null;
    inizioIl: Date;
    scadeIl?: Date | null;
    rinnovoAutomatico: boolean;
    preavvisoGiorni: number;
  };
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

const UNITA_BREVE: Record<string, string> = {
  ORE: "h", GIORNI: "gg", CORPO: "a corpo", PEZZI: "pz", MESI: "mesi",
};

const PERIODICITA: Record<string, string> = {
  MENSILE: "mensile", TRIMESTRALE: "trimestrale",
  SEMESTRALE: "semestrale", ANNUALE: "annuale",
};

type Contesto = {
  doc: PDFKit.PDFDocument;
  d: DatiDocumento;
  stile: StilePdf;
  destra: number;
};

export function generaPdf(
  d: DatiDocumento,
  blocchi: BloccoPdf[],
  stileParziale: Partial<StilePdf> = {},
): Promise<Buffer> {
  const stile = { ...STILE_PREDEFINITO, ...stileParziale };
  const doc = new PDFDocument({ size: "A4", margin: stile.margine });
  const pezzi: Buffer[] = [];
  doc.on("data", (c: Buffer) => pezzi.push(c));
  const finito = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(pezzi))));

  // Registrate esplicitamente: senza, il simbolo dell'euro non viene reso.
  doc.registerFont("corpo", "Helvetica");
  doc.registerFont("grassetto", "Helvetica-Bold");

  const ctx: Contesto = { doc, d, stile, destra: 595 - stile.margine };

  for (const b of blocchi) {
    if (!b.attivo) continue;
    const disegna = DISEGNATORI[b.tipo];
    if (disegna) disegna(ctx, b.config);
  }

  if (stile.mostraNumerazione) {
    const pagine = doc.bufferedPageRange();
    for (let i = 0; i < pagine.count; i++) {
      doc.switchToPage(pagine.start + i);
      doc.fontSize(7.5).font("corpo").fillColor("#999");
      doc.text(`${i + 1} / ${pagine.count}`, stile.margine, 800, {
        width: ctx.destra - stile.margine,
        align: "right",
      });
    }
  }

  doc.end();
  return finito;
}

type Disegnatore = (ctx: Contesto, config: Record<string, string | number | boolean>) => void;

const DISEGNATORI: Record<string, Disegnatore> = {
  intestazione({ doc, d, stile }, c) {
    const e = d.emittente;
    // Il logo occupa una colonna a sinistra solo se c'è davvero: senza,
    // il testo prende tutta la larghezza invece di lasciare un vuoto.
    const conLogo = c.mostraLogo && e.logo;
    const xTesto = conLogo ? stile.margine + 60 : stile.margine;
    const y0 = doc.y;

    if (conLogo) {
      try {
        doc.image(e.logo as Buffer, stile.margine, y0, { fit: [48, 48] });
      } catch {
        /* logo illeggibile: si stampa comunque il resto dell'intestazione */
      }
    }

    doc.fontSize(18).font("grassetto").fillColor("#000");
    doc.text(e.ragioneSociale, xTesto, y0);
    doc.fontSize(9).font("corpo").fillColor("#666");

    // Ogni riga compare solo se il dato c'è e il blocco è configurato per
    // mostrarla: un campo lasciato vuoto in Azienda non stampa un'etichetta
    // senza valore.
    if (c.mostraIndirizzo && (e.indirizzo || e.citta)) {
      const luogo = [e.cap, e.citta, e.provincia && `(${e.provincia})`].filter(Boolean).join(" ");
      doc.text([e.indirizzo, luogo].filter(Boolean).join(" · "), xTesto);
    }
    if (c.mostraPartitaIva && e.partitaIva) doc.text(`P.IVA ${e.partitaIva}`, xTesto);
    if (c.mostraCodiceFiscale && e.codiceFiscale && e.codiceFiscale !== e.partitaIva) {
      doc.text(`C.F. ${e.codiceFiscale}`, xTesto);
    }
    if (c.mostraContatti && (e.telefono || e.email || e.pec)) {
      doc.text([e.telefono, e.email, e.pec].filter(Boolean).join(" · "), xTesto);
    }
    if (c.mostraIban && e.iban) doc.text(`IBAN ${e.iban}`, xTesto);
    if (c.mostraRegimeFiscale && e.regimeFiscale) doc.text(e.regimeFiscale, xTesto);

    doc.fillColor("#000").x = stile.margine;
    doc.y = Math.max(doc.y, y0 + (conLogo ? 52 : 0));
    doc.moveDown(1.2);
  },

  bollo({ doc, d, stile }, c) {
    if (!d.bollo || !d.riepilogo) return;
    const soglia = Number(c.soglia) || d.bollo.soglia;
    if (d.riepilogo.imponibile < soglia) return;
    if (doc.y > 700) doc.addPage();
    doc.fontSize(8).font("corpo").fillColor("#666");
    doc.text(
      `Imposta di bollo assolta in modo virtuale, € ${d.bollo.importo.toFixed(2)} (importo oltre € ${soglia.toFixed(2)}).`,
      stile.margine,
      doc.y,
    );
    doc.fillColor("#000").moveDown(0.6);
  },

  titolo({ doc, d, stile }, c) {
    doc.fontSize(15).font("grassetto").fillColor(stile.coloreAccento);
    const rev = c.mostraRevisione && d.revisione ? ` · ${d.revisione}` : "";
    doc.text(`${String(c.prefisso ?? "")}${d.numero}${rev}`, stile.margine, doc.y);
    doc.fontSize(11).font("corpo").fillColor("#000").text(d.titolo);
    if (d.tipo) doc.fontSize(9).fillColor("#666").text(d.tipo).fillColor("#000");
    doc.moveDown(1);
  },

  destinatario({ doc, d, stile, destra }, c) {
    const y0 = doc.y;
    doc.fontSize(8).fillColor("#666").text("DESTINATARIO", stile.margine, y0);
    doc.fontSize(10).fillColor("#000").font("grassetto");
    doc.text(d.cliente.ragioneSociale, stile.margine, doc.y + 2, { width: 240 });
    doc.font("corpo").fontSize(9).fillColor("#444");
    if (c.mostraPartitaIva && d.cliente.partitaIva) {
      doc.text(`P.IVA ${d.cliente.partitaIva}`, { width: 240 });
    }
    if (d.cliente.citta) doc.text(d.cliente.citta, { width: 240 });
    if (c.mostraReferente && d.cliente.referente) {
      doc.text(`Alla c.a. ${d.cliente.referente}`, { width: 240 });
    }

    if (c.mostraDate) {
      doc.fontSize(8).fillColor("#666").text("DATA", 340, y0);
      doc.fontSize(10).fillColor("#000").text(dataIt(d.dataEmissione), 340, doc.y + 2);
      if (d.scadeIl) {
        doc.fontSize(8).fillColor("#666").text("VALIDA FINO AL", 340, doc.y + 6);
        doc.fontSize(10).fillColor("#000").text(dataIt(d.scadeIl), 340, doc.y + 2);
      } else if (d.validitaGiorni) {
        doc.fontSize(8).fillColor("#666").text("VALIDITÀ", 340, doc.y + 6);
        doc.fontSize(10).fillColor("#000").text(`${d.validitaGiorni} giorni`, 340, doc.y + 2);
      }
    }

    doc.x = stile.margine;
    doc.fillColor("#000").moveDown(1.5);
  },

  parti({ doc, d, stile }, c) {
    const y0 = doc.y;
    doc.fontSize(8).fillColor("#666").text(String(c.etichettaPrima ?? "TRA"), stile.margine, y0);
    doc.fontSize(10).fillColor("#000").font("grassetto");
    doc.text(d.emittente.ragioneSociale, stile.margine, doc.y + 2, { width: 230 });
    doc.font("corpo").fontSize(9).fillColor("#444");
    if (d.emittente.partitaIva) doc.text(`P.IVA ${d.emittente.partitaIva}`, { width: 230 });
    if (d.emittente.codiceFiscale && d.emittente.codiceFiscale !== d.emittente.partitaIva) {
      doc.text(`C.F. ${d.emittente.codiceFiscale}`, { width: 230 });
    }
    if (d.emittente.indirizzo || d.emittente.citta) {
      doc.text([d.emittente.indirizzo, d.emittente.citta].filter(Boolean).join(", "), { width: 230 });
    }

    doc.fontSize(8).fillColor("#666").text(String(c.etichettaSeconda ?? "E"), 320, y0);
    doc.fontSize(10).fillColor("#000").font("grassetto");
    doc.text(d.cliente.ragioneSociale, 320, doc.y + 2, { width: 220 });
    doc.font("corpo").fontSize(9).fillColor("#444");
    if (d.cliente.partitaIva) doc.text(`P.IVA ${d.cliente.partitaIva}`, { width: 220 });
    if (d.cliente.citta) doc.text(d.cliente.citta, { width: 220 });
    if (d.cliente.referente) doc.text(`Referente: ${d.cliente.referente}`, { width: 220 });

    doc.x = stile.margine;
    doc.fillColor("#000").moveDown(1.5);
  },

  testo({ doc, d, stile, destra }, c) {
    const contenuto = d.testi[String(c.campo)];
    // Un blocco senza contenuto non lascia spazi vuoti nel documento.
    if (!contenuto) return;

    if (doc.y > 700) doc.addPage();
    if (c.titolo) {
      doc.fontSize(8).font("grassetto").fillColor("#666");
      doc.text(String(c.titolo).toUpperCase(), stile.margine, doc.y);
      doc.moveDown(0.3);
    }
    doc.fontSize(stile.dimensioneBase).font("corpo").fillColor("#000");
    doc.text(contenuto, stile.margine, doc.y, {
      width: destra - stile.margine,
      align: c.giustificato ? "justify" : "left",
    });
    doc.moveDown(0.8);
  },

  voci({ doc, d, stile, destra }, c) {
    if (!d.voci?.length) return;

    const col = {
      desc: stile.margine,
      qta: 300,
      unita: 350,
      prezzo: 400,
      sconto: 462,
      tot: 500,
    };

    const intestazione = (y: number) => {
      doc.fontSize(8).font("grassetto").fillColor("#666");
      doc.text("DESCRIZIONE", col.desc, y);
      doc.text("Q.TÀ", col.qta, y, { width: 40, align: "right" });
      if (c.mostraUnita) doc.text("U.M.", col.unita, y, { width: 40 });
      doc.text("PREZZO", col.prezzo, y, { width: 55, align: "right" });
      if (c.mostraSconto) doc.text("SC.", col.sconto, y, { width: 30, align: "right" });
      doc.text("TOTALE", col.tot, y, { width: 39, align: "right" });
      doc.moveTo(stile.margine, y + 12).lineTo(destra, y + 12).strokeColor("#ddd").stroke();
      return y + 18;
    };

    let y = intestazione(doc.y);
    doc.font("corpo").fillColor("#000");

    for (const v of d.voci) {
      if (y > 700) {
        doc.addPage();
        y = intestazione(stile.margine);
        doc.font("corpo").fillColor("#000");
      }
      const totale = v.quantita * v.prezzo * (1 - (v.sconto || 0) / 100);
      doc.fontSize(stile.dimensioneBase);
      const altezza = doc.heightOfString(v.descrizione, { width: 230 });
      doc.text(v.descrizione, col.desc, y, { width: 230 });
      doc.text(String(v.quantita).replace(".", ","), col.qta, y, { width: 40, align: "right" });
      if (c.mostraUnita) doc.text(UNITA_BREVE[v.unita] ?? "", col.unita, y, { width: 40 });
      doc.text(NUM.format(v.prezzo), col.prezzo, y, { width: 55, align: "right" });
      if (c.mostraSconto) {
        doc.text(v.sconto ? `${v.sconto}%` : "—", col.sconto, y, { width: 30, align: "right" });
      }
      doc.text(NUM.format(totale), col.tot, y, { width: 39, align: "right" });

      y += Math.max(altezza, 12) + 2;
      if (c.mostraNote && v.nota) {
        doc.fontSize(8).fillColor("#777");
        doc.text(v.nota, col.desc, y, { width: 230 });
        y += doc.heightOfString(v.nota, { width: 230 }) + 2;
        doc.fillColor("#000");
      }
      y += 4;
    }

    doc.y = y;
    doc.x = stile.margine;
  },

  riepilogo({ doc, d, stile, destra }, c) {
    if (!d.riepilogo) return;
    const r = d.riepilogo;

    doc.moveTo(stile.margine, doc.y).lineTo(destra, doc.y).strokeColor("#ddd").stroke();
    let y = doc.y + 10;

    const riga = (etichetta: string, valore: string, grassetto = false) => {
      doc.fontSize(grassetto ? 11 : stile.dimensioneBase);
      doc.font(grassetto ? "grassetto" : "corpo");
      doc.fillColor(grassetto ? "#000" : "#444");
      doc.text(etichetta, 340, y, { width: 100, align: "right" });
      doc.text(valore, 440, y, { width: 99, align: "right" });
      y += grassetto ? 18 : 14;
    };

    if (c.mostraSconti && r.scontiRiga > 0) {
      riga("Sconti di riga", `- ${NUM.format(r.scontiRiga)}`);
    }
    if (c.mostraSconti && r.scontoTotale > 0) {
      riga(`Sconto ${d.scontoPercento}%`, `- ${NUM.format(r.scontoTotale)}`);
    }
    riga("Imponibile", NUM.format(r.imponibile));
    riga(`IVA ${d.aliquotaIva}%`, NUM.format(r.iva));
    y += 2;
    doc.moveTo(340, y).lineTo(destra, y).strokeColor("#ccc").stroke();
    y += 8;
    riga("TOTALE", eur(r.totale), true);

    doc.y = y;
    doc.x = stile.margine;
  },

  corrispettivo({ doc, d, stile, destra }, c) {
    if (!d.contratto) return;
    const k = d.contratto;

    if (doc.y > 620) doc.addPage();
    doc.fontSize(8).font("grassetto").fillColor("#666");
    doc.text("CORRISPETTIVO E DURATA", stile.margine, doc.y);
    doc.moveDown(0.4);

    const voci: [string, string][] = [
      ["Canone", `${eur(k.canone)} · ${PERIODICITA[k.periodicita] ?? k.periodicita}`],
    ];
    if (c.mostraMonteOre && k.monteOre) {
      voci.push(["Ore incluse", `${k.monteOre.toLocaleString("it-IT")} h per periodo`]);
      if (k.tariffaExtra) voci.push(["Ore eccedenti", `${eur(k.tariffaExtra)} per ora`]);
    }
    voci.push(["Decorrenza", dataIt(k.inizioIl)]);
    voci.push(["Scadenza", k.scadeIl ? dataIt(k.scadeIl) : "senza termine"]);
    voci.push([
      "Rinnovo",
      k.rinnovoAutomatico
        ? `tacito, salvo disdetta con ${k.preavvisoGiorni} giorni di preavviso`
        : "non automatico",
    ]);

    for (const [kk, vv] of voci) {
      const y = doc.y;
      doc.fontSize(9).font("corpo").fillColor("#666").text(kk, stile.margine, y, { width: 140 });
      doc.fillColor("#000").text(vv, 200, y, { width: destra - 200 });
      doc.moveDown(0.35);
    }
    doc.moveDown(0.8);
  },

  firme({ doc, d, stile }, c) {
    if (doc.y > 640) doc.addPage();
    doc.moveDown(2);
    const y = doc.y;
    doc.fontSize(8).font("corpo").fillColor("#666");
    doc.text(String(c.etichettaPrima ?? "Il prestatore"), stile.margine, y, { width: 200 });
    doc.text(String(c.etichettaSeconda ?? "Il committente"), 320, y, { width: 200 });
    doc.moveTo(stile.margine, y + 42).lineTo(stile.margine + 200, y + 42).strokeColor("#999").stroke();
    doc.moveTo(320, y + 42).lineTo(520, y + 42).strokeColor("#999").stroke();
    doc.fontSize(8).fillColor("#888");
    doc.text(d.emittente.ragioneSociale, stile.margine, y + 46, { width: 200 });
    doc.text(d.cliente.ragioneSociale, 320, y + 46, { width: 200 });
    doc.y = y + 60;
  },

  spazio({ doc }, c) {
    doc.y += Number(c.altezza ?? 20);
  },

  separatore({ doc, stile, destra }) {
    doc.moveTo(stile.margine, doc.y).lineTo(destra, doc.y).strokeColor("#ddd").stroke();
    doc.y += 10;
  },
};
