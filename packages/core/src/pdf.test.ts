import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  type DatiPdf,
  decodificaLogo,
  generaPdf,
  MODELLO_PDF_PREDEFINITO,
  modelloPdfSchema,
  perPdf,
} from "./pdf";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Testo mostrato nelle pagine: i font standard scrivono stringhe esadecimali in WinAnsi. */
async function testoDi(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, oggetto] of doc.context.enumerateIndirectObjects()) {
    if (!(oggetto instanceof PDFRawStream) || oggetto.dict.has(PDFName.of("Subtype"))) continue;
    const contenuto = Buffer.from(decodePDFRawStream(oggetto).decode()).toString("latin1");
    for (const m of contenuto.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const esa = m[1] ?? "";
      let riga = "";
      for (let i = 0; i < esa.length; i += 2) {
        const c = Number.parseInt(esa.slice(i, i + 2), 16);
        riga += c === 0x80 ? "€" : String.fromCharCode(c);
      }
      out += `${riga}\n`;
    }
  }
  return out;
}

const base: DatiPdf = {
  tipo: "preventivo",
  numero: "P-2026-001",
  data: "2026-11-02",
  scadenza: "2026-12-02",
  oggetto: "Sito vetrina con prenotazioni",
  note: "Pagamento 50% all'accettazione.",
  emittente: {
    nome: "Studio Rossi S.r.l.",
    partitaIva: "01234567897",
    indirizzo: "Via Roma 1",
    cap: "24100",
    citta: "Bergamo",
    provincia: "BG",
    email: "info@studiorossi.it",
    iban: "IT60X0542811101000000123456",
  },
  cliente: {
    nome: "Trattoria Da Marco",
    partitaIva: "09876543210",
    pec: "trattoria@pec.it",
    codiceSdi: "KRRH6B9",
    citta: "Bergamo",
  },
  righe: [
    {
      descrizione: "Sito web",
      quantita: 1,
      prezzoUnitarioCent: 100000,
      scontoBp: 0,
      importoCent: 100000,
    },
    {
      descrizione: "Hosting e manutenzione",
      dettaglio: "canone annuo",
      quantita: 1,
      prezzoUnitarioCent: 20000,
      scontoBp: 1000,
      importoCent: 18000,
    },
  ],
  imponibileCent: 118000,
  ivaCent: 25960,
  bolloCent: 0,
  totaleCent: 143960,
  ivaAttiva: true,
  aliquotaIvaBp: 2200,
};

describe("PDF di un preventivo", () => {
  it("produce un PDF valido di una pagina con i dati del documento", async () => {
    const pdf = await generaPdf(base, MODELLO_PDF_PREDEFINITO);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    const t = await testoDi(pdf);
    for (const atteso of [
      "Preventivo",
      "P-2026-001",
      "Studio Rossi S.r.l.",
      "P.IVA",
      "01234567897",
      "Trattoria Da Marco",
      "Codice SDI",
      "KRRH6B9",
      "Sito vetrina con prenotazioni",
      "Valido fino al",
      "02/12/2026",
      "Hosting e manutenzione",
      "canone annuo",
      "10%",
      "€ 1.180,00",
      "IVA 22%",
      "€ 259,60",
      "€ 1.439,60",
      "Pagamento 50% all'accettazione.",
      "Pagina 1 di 1",
    ])
      expect(t, atteso).toContain(atteso);
  });

  it("una bozza senza numero lo dice", async () => {
    const t = await testoDi(await generaPdf({ ...base, numero: null }, MODELLO_PDF_PREDEFINITO));
    expect(t).toContain("Bozza");
    expect(t).not.toContain("N. null");
  });

  it("molte righe vanno su più pagine, con la numerazione corretta", async () => {
    const righe = Array.from({ length: 90 }, (_, i) => ({
      descrizione: `Voce numero ${i + 1} con una descrizione abbastanza lunga da occupare spazio`,
      quantita: 1,
      prezzoUnitarioCent: 1000,
      scontoBp: 0,
      importoCent: 1000,
    }));
    const pdf = await generaPdf({ ...base, righe }, MODELLO_PDF_PREDEFINITO);
    const pagine = (await PDFDocument.load(pdf)).getPageCount();
    expect(pagine).toBeGreaterThan(1);
    const t = await testoDi(pdf);
    expect(t).toContain(`Pagina ${pagine} di ${pagine}`);
    expect(t).toContain("Voce numero 90");
    expect(t).toContain("Totale"); // i totali non vengono persi nel salto di pagina
  });

  it("note e piè di pagina del modello compaiono; quelle dell'altro tipo no", async () => {
    const modello = modelloPdfSchema.parse({
      notePreventivo: "Offerta valida salvo venduto.",
      noteFattura: "Grazie per la fiducia.",
      piePagina: "Studio Rossi · REA BG-123456",
    });
    const t = await testoDi(await generaPdf(base, modello));
    expect(t).toContain("Offerta valida salvo venduto.");
    expect(t).not.toContain("Grazie per la fiducia.");
    expect(t).toContain("REA BG-123456");
  });

  it("l'IBAN si mostra solo se richiesto", async () => {
    const con = await testoDi(
      await generaPdf(base, { ...MODELLO_PDF_PREDEFINITO, mostraIban: true }),
    );
    const senza = await testoDi(
      await generaPdf(base, { ...MODELLO_PDF_PREDEFINITO, mostraIban: false }),
    );
    expect(con).toContain("IT60X0542811101000000123456");
    expect(senza).not.toContain("IT60X0542811101000000123456");
  });
});

describe("PDF di una fattura", () => {
  const fattura: DatiPdf = {
    ...base,
    tipo: "fattura",
    numero: "F-2026-007",
    oggetto: null,
    scadenza: "2026-12-02",
    ivaAttiva: false,
    aliquotaIvaBp: 0,
    diciturSenzaIva: "Operazione non soggetta a IVA ai sensi dell'art. 4 DPR 633/72",
    ivaCent: 0,
    bolloCent: 200,
    imponibileCent: 118000,
    totaleCent: 118200,
    ritenutaCent: 23600,
    nettoDaPagareCent: 94600,
  };

  it("senza IVA mostra la dicitura, il bollo, la ritenuta e il netto da pagare", async () => {
    const t = await testoDi(await generaPdf(fattura, MODELLO_PDF_PREDEFINITO));
    expect(t).toContain("Fattura");
    expect(t).toContain("Scadenza");
    expect(t).toContain("02/12/2026");
    expect(t).toContain("Operazione non soggetta a IVA ai sensi dell'art. 4 DPR 633/72");
    expect(t).not.toMatch(/IVA \d+%/);
    expect(t).toContain("Bollo");
    expect(t).toContain("− €".replace("−", "-") + " 236,00");
    expect(t).toContain("Netto da pagare");
    expect(t).toContain("€ 946,00");
  });

  it("usa le note delle fatture, non quelle dei preventivi", async () => {
    const modello = modelloPdfSchema.parse({ notePreventivo: "NOTA-P", noteFattura: "NOTA-F" });
    const t = await testoDi(await generaPdf(fattura, modello));
    expect(t).toContain("NOTA-F");
    expect(t).not.toContain("NOTA-P");
  });
});

describe("robustezza", () => {
  it("caratteri fuori dal set standard e parole lunghissime non fanno fallire il PDF", async () => {
    const dati: DatiPdf = {
      ...base,
      oggetto: "Prova → ✓ 😀 “virgolette” – trattino",
      righe: [
        {
          descrizione: `${"x".repeat(400)} fine`,
          quantita: 1,
          prezzoUnitarioCent: 100,
          scontoBp: 0,
          importoCent: 100,
        },
      ],
    };
    const pdf = await generaPdf(dati, MODELLO_PDF_PREDEFINITO);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(1);
    const t = await testoDi(pdf);
    expect(t).toContain('"virgolette" - trattino');
    expect(perPdf("a→b")).toBe("a?b");
  });

  it("un logo PNG valido viene inserito; uno danneggiato non blocca il documento", async () => {
    const senza = await generaPdf(base, MODELLO_PDF_PREDEFINITO);
    const con = await generaPdf(base, { ...MODELLO_PDF_PREDEFINITO, logo: PNG });
    expect(con.length).toBeGreaterThan(senza.length);
    const rotto = `data:image/png;base64,${Buffer.from("\x89PNG\r\n\x1a\n-non-un-vero-png-").toString("base64")}`;
    const r = await generaPdf(base, { ...MODELLO_PDF_PREDEFINITO, logo: rotto });
    expect(Buffer.from(r.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("nessun valore opzionale mancante rompe il disegno", async () => {
    const minimo: DatiPdf = {
      tipo: "fattura",
      numero: null,
      data: null,
      scadenza: null,
      emittente: { nome: "X" },
      cliente: { nome: "" },
      righe: [],
      imponibileCent: 0,
      ivaCent: 0,
      bolloCent: 0,
      totaleCent: 0,
      ivaAttiva: true,
      aliquotaIvaBp: 2200,
    };
    const pdf = await generaPdf(minimo, MODELLO_PDF_PREDEFINITO);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});

describe("modello e logo", () => {
  it("applica i valori predefiniti", () => {
    expect(modelloPdfSchema.parse({})).toEqual(MODELLO_PDF_PREDEFINITO);
  });
  it("rifiuta colori non esadecimali", () => {
    for (const colore of ["rosso", "#fff", "#12345g", "3e63dd"])
      expect(modelloPdfSchema.safeParse({ colore }).success, colore).toBe(false);
    expect(modelloPdfSchema.safeParse({ colore: "#3E63DD" }).success).toBe(true);
  });
  it("accetta solo PNG e JPEG veri, fino a 200 KB", () => {
    expect(decodificaLogo(PNG)?.tipo).toBe("png");
    expect(decodificaLogo("data:image/webp;base64,UklGRg==")).toBeNull();
    expect(decodificaLogo("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(decodificaLogo("data:image/png;base64,AAAAAAAAAAAA")).toBeNull();
    expect(decodificaLogo("https://esempio.it/logo.png")).toBeNull();
    const grande = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(300_000)]).toString("base64")}`;
    expect(decodificaLogo(grande)).toBeNull();
    expect(modelloPdfSchema.safeParse({ logo: "data:image/webp;base64,UklGRg==" }).success).toBe(
      false,
    );
    expect(modelloPdfSchema.safeParse({ logo: "" }).success).toBe(true);
  });
  it("limita la lunghezza dei testi", () => {
    expect(modelloPdfSchema.safeParse({ piePagina: "x".repeat(301) }).success).toBe(false);
    expect(modelloPdfSchema.safeParse({ noteFattura: "x".repeat(1001) }).success).toBe(false);
  });
});

/** Contenuto grezzo delle pagine: serve a verificare cose che non sono testo, come il colore di una riga barrata. */
async function contenutoDi(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, oggetto] of doc.context.enumerateIndirectObjects()) {
    if (!(oggetto instanceof PDFRawStream) || oggetto.dict.has(PDFName.of("Subtype"))) continue;
    out += Buffer.from(decodePDFRawStream(oggetto).decode()).toString("latin1");
  }
  return out;
}
const ROSSO_OP = /0\.70\d* 0\.13\d* 0\.09\d* rg/;

const G = "g1";
const conAbbonamenti: DatiPdf = {
  ...base,
  righe: [
    {
      descrizione: "Sito web",
      tipo: "una_tantum",
      quantita: 1,
      prezzoUnitarioCent: 100000,
      scontoBp: 0,
      importoCent: 100000,
    },
    {
      descrizione: "SEO",
      tipo: "una_tantum",
      quantita: 1,
      prezzoUnitarioCent: 30000,
      scontoBp: 0,
      importoCent: 30000,
    },
    {
      descrizione: "Manutenzione — canone annuo",
      tipo: "canone_annuo",
      gruppoId: G,
      quantita: 1,
      prezzoUnitarioCent: 60000,
      scontoBp: 0,
      importoCent: 60000,
    },
    {
      descrizione: "Manutenzione — canone mensile",
      tipo: "canone_mensile",
      gruppoId: G,
      quantita: 1,
      prezzoUnitarioCent: 6000,
      scontoBp: 0,
      importoCent: 6000,
    },
    {
      descrizione: "Hosting",
      tipo: "canone_mensile",
      quantita: 1,
      prezzoUnitarioCent: 5000,
      scontoBp: 0,
      importoCent: 5000,
    },
  ],
  imponibileCent: 130000,
  ivaCent: 28600,
  bolloCent: 0,
  totaleCent: 158600,
};
const decisione = (accettate: string[]): DatiPdf["righe"] =>
  (conAbbonamenti.righe as DatiPdf["righe"]).map((r) => ({
    ...r,
    accettata: accettate.includes(r.descrizione),
  }));

describe("PDF di un preventivo con abbonamenti", () => {
  it("prima dell'accettazione separa le sezioni e mostra le alternative con «oppure», senza sommarle", async () => {
    const bytes = await generaPdf(conAbbonamenti, MODELLO_PDF_PREDEFINITO);
    const t = await testoDi(bytes);
    for (const atteso of [
      "Prestazioni una tantum",
      "Abbonamenti",
      "Servizio",
      "Periodicità",
      "Annuale",
      "Mensile",
      "oppure Manutenzione",
      "€ 600,00 / anno",
      "€ 60,00 / mese",
      "€ 50,00 / mese",
      "alternative: il cliente sceglie una sola periodicità",
      "non sono compresi nei totali",
      "Totale una tantum",
      "€ 1.586,00",
    ])
      expect(t, atteso).toContain(atteso);
    // il totale una tantum non contiene i canoni (600+60+50)
    expect(t).not.toContain("€ 2.296,00");
    expect(t).not.toContain("Non accettata");
    expect(ROSSO_OP.test(await contenutoDi(bytes))).toBe(false);
  });

  it("senza IVA non mostra la colonna dei canoni ivati", async () => {
    const t = await testoDi(
      await generaPdf({ ...conAbbonamenti, ivaAttiva: false }, MODELLO_PDF_PREDEFINITO),
    );
    expect(t).not.toContain("IVA inclusa");
    expect(t).toContain("Abbonamenti");
  });

  it("dopo l'accettazione parziale: righe escluse indicate e barrate, totali accettati, offerta originale visibile", async () => {
    const accettate = ["Sito web", "Manutenzione — canone annuo", "Hosting"];
    const dati: DatiPdf = {
      ...conAbbonamenti,
      righe: decisione(accettate),
      accettazione: {
        stato: "accettato_parzialmente",
        imponibileCent: 100000,
        ivaCent: 22000,
        bolloCent: 0,
        totaleCent: 122000,
      },
    };
    const bytes = await generaPdf(dati, MODELLO_PDF_PREDEFINITO);
    const t = await testoDi(bytes);
    for (const atteso of [
      "Esito",
      "Parziale",
      "Non accettata", // la SEO
      "Alternativa non scelta", // il canone mensile della manutenzione
      "Imponibile originale",
      "€ 1.300,00",
      "Imponibile accettato",
      "€ 1.000,00",
      "Totale accettato",
      "€ 1.220,00",
    ])
      expect(t, atteso).toContain(atteso);
    // le righe escluse restano nel documento
    expect(t).toContain("SEO");
    expect(t).toContain("€ 60,00 / mese");
    expect(ROSSO_OP.test(await contenutoDi(bytes))).toBe(true);
    // l'avviso sulle alternative non serve più: la scelta è fatta
    expect(t).not.toContain("il cliente sceglie una sola periodicità");
  });

  it("accettazione totale: nessuna riga barrata e totali accettati", async () => {
    const dati: DatiPdf = {
      ...conAbbonamenti,
      righe: decisione(["Sito web", "SEO", "Manutenzione — canone mensile", "Hosting"]),
      accettazione: {
        stato: "accettato",
        imponibileCent: 130000,
        ivaCent: 28600,
        bolloCent: 0,
        totaleCent: 158600,
      },
    };
    const bytes = await generaPdf(dati, MODELLO_PDF_PREDEFINITO);
    const t = await testoDi(bytes);
    expect(t).toContain("Accettato");
    expect(t).not.toContain("Parziale");
    expect(t).toContain("Alternativa non scelta"); // il canone annuo non scelto resta documentato
    expect(t).not.toContain("Non accettata");
  });

  it("un intero servizio rifiutato risulta «Non accettata» in entrambe le alternative", async () => {
    const dati: DatiPdf = {
      ...conAbbonamenti,
      righe: decisione(["Sito web", "SEO", "Hosting"]),
      accettazione: {
        stato: "accettato_parzialmente",
        imponibileCent: 130000,
        ivaCent: 28600,
        bolloCent: 0,
        totaleCent: 158600,
      },
    };
    const t = await testoDi(await generaPdf(dati, MODELLO_PDF_PREDEFINITO));
    expect(t.match(/Non accettata/g)?.length).toBe(2);
    expect(t).not.toContain("Alternativa non scelta");
  });

  it("le fatture e i preventivi senza tipo di riga mantengono il layout a tabella unica", async () => {
    const t = await testoDi(await generaPdf(base, MODELLO_PDF_PREDEFINITO));
    expect(t).not.toContain("Prestazioni una tantum");
    expect(t).not.toContain("Abbonamenti");
  });

  it("molti abbonamenti vanno a pagina nuova senza perdere righe", async () => {
    const molti: DatiPdf = {
      ...conAbbonamenti,
      righe: Array.from({ length: 60 }, (_, i) => ({
        descrizione: `Servizio ${i + 1}`,
        tipo: "canone_mensile" as const,
        quantita: 1,
        prezzoUnitarioCent: 1000,
        scontoBp: 0,
        importoCent: 1000,
      })),
    };
    const bytes = await generaPdf(molti, MODELLO_PDF_PREDEFINITO);
    const t = await testoDi(bytes);
    expect(t).toContain("Servizio 1");
    expect(t).toContain("Servizio 60");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
