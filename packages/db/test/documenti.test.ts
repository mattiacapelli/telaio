import { generaPdf, MODELLO_PDF_PREDEFINITO } from "@telaio/core";
import { eq } from "drizzle-orm";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { datiPdfEsempio, datiPdfFattura, datiPdfPreventivo } from "../src/documenti-pdf";
import {
  leggiEmail,
  leggiModelliPdfSalvati,
  leggiModelloPdf,
  salvaFirmaEmail,
  salvaMittente,
  salvaModelloPdf,
} from "../src/impostazioni-documenti";
import {
  fatturaRighe,
  fatture,
  impostazioni,
  preventivi,
  preventivoRighe,
  ragioniSociali,
} from "../src/schema";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

async function testoDi(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, o] of doc.context.enumerateIndirectObjects()) {
    if (!(o instanceof PDFRawStream) || o.dict.has(PDFName.of("Subtype"))) continue;
    const c = Buffer.from(decodePDFRawStream(o).decode()).toString("latin1");
    for (const m of c.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const h = m[1] ?? "";
      for (let i = 0; i < h.length; i += 2) {
        const b = Number.parseInt(h.slice(i, i + 2), 16);
        out += b === 0x80 ? "€" : String.fromCharCode(b);
      }
      out += "\n";
    }
  }
  return out;
}

describe.skipIf(!URL_SERVER)("email, modelli PDF e documenti (Postgres reale)", () => {
  let t: DbTemporaneo;
  let rsId: string;

  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
    const [rs] = await t.db
      .insert(ragioniSociali)
      .values({
        nome: "MC Digital S.r.l.",
        partitaIva: "01234567897",
        indirizzo: "Via Roma 1",
        cap: "24100",
        citta: "Bergamo",
        provincia: "BG",
        email: "amministrazione@mcdigital.it",
        pec: "mcdigital@pec.it",
        iban: "IT60X0542811101000000123456",
      })
      .returning();
    rsId = rs?.id ?? "";
  });
  afterAll(async () => {
    await t?.elimina();
  });

  async function creaPreventivo(over: Partial<typeof preventivi.$inferInsert> = {}) {
    const [p] = await t.db
      .insert(preventivi)
      .values({
        ragioneSocialeId: rsId,
        anno: 2026,
        numero: "P-2026-001",
        oggetto: "Sito vetrina",
        note: "Note del preventivo",
        validoFino: "2026-12-31",
        snapshot: {
          emittente: { id: rsId, nome: "MC Digital S.r.l.", partitaIva: "01234567897" },
          cliente: {
            nome: "Trattoria Da Marco",
            partitaIva: "09876543210",
            codiceSdi: "KRRH6B9",
            citta: "Bergamo",
          },
          regole: { ivaAttiva: true, aliquotaIvaBp: 2200 },
        },
        imponibileCent: 120000,
        ivaCent: 26400,
        totaleCent: 146400,
        ...over,
      })
      .returning();
    const id = p?.id ?? "";
    await t.db.insert(preventivoRighe).values([
      {
        preventivoId: id,
        posizione: 1,
        descrizione: "Canone hosting",
        tipo: "canone_annuo",
        prezzoUnitarioCent: 20000,
        importoCent: 20000,
      },
      {
        preventivoId: id,
        posizione: 0,
        descrizione: "Sito web",
        prezzoUnitarioCent: 100000,
        importoCent: 100000,
      },
    ]);
    return id;
  }

  describe("impostazioni email", () => {
    it("sono vuote all'inizio", async () => {
      expect(await leggiEmail(t.db)).toEqual({ firma: "", mittenti: {} });
    });
    it("firma e mittenti si salvano e si ritrovano", async () => {
      await salvaFirmaEmail(t.db, "  Mattia Capelli\nMC Digital ");
      await salvaMittente(t.db, rsId, {
        nome: "Fatturazione",
        email: "fatture@mcdigital.it",
        rispondiA: "info@mcdigital.it",
      });
      const e = await leggiEmail(t.db);
      expect(e.firma).toBe("Mattia Capelli\nMC Digital");
      expect(e.mittenti[rsId]).toEqual({
        nome: "Fatturazione",
        email: "fatture@mcdigital.it",
        rispondiA: "info@mcdigital.it",
      });
    });
    it("salvare la firma non cancella i mittenti e viceversa", async () => {
      await salvaMittente(t.db, rsId, { email: "a@b.it" });
      await salvaFirmaEmail(t.db, "Firma");
      await salvaMittente(t.db, "altra-rs", { email: "c@d.it" });
      const e = await leggiEmail(t.db);
      expect(e.firma).toBe("Firma");
      expect(Object.keys(e.mittenti).sort()).toEqual([rsId, "altra-rs"].sort());
    });
    it("salvataggi simultanei di ragioni sociali diverse non si sovrascrivono", async () => {
      const ids = Array.from({ length: 10 }, (_, i) => `rs-${i}`);
      await Promise.all(
        ids.map((id, i) => salvaMittente(t.db, id, { email: `m${i}@example.com` })),
      );
      expect(Object.keys((await leggiEmail(t.db)).mittenti).sort()).toEqual([...ids].sort());
    });
    it("un indirizzo non valido non viene salvato", async () => {
      await expect(salvaMittente(t.db, rsId, { email: "non-valida" })).rejects.toThrow();
      expect((await leggiEmail(t.db)).mittenti).toEqual({});
    });
    it("un valore corrotto nel database non rompe la lettura", async () => {
      await t.db
        .insert(impostazioni)
        .values({ chiave: "email", valore: { firma: 42, mittenti: "no" } });
      expect(await leggiEmail(t.db)).toEqual({ firma: "", mittenti: {} });
    });
  });

  describe("modelli PDF", () => {
    it("senza nulla di salvato vale il modello predefinito", async () => {
      expect(await leggiModelloPdf(t.db, rsId)).toEqual(MODELLO_PDF_PREDEFINITO);
    });
    it("il modello di una ragione sociale non tocca le altre", async () => {
      await salvaModelloPdf(t.db, rsId, {
        colore: "#112233",
        piePagina: "REA 1",
        mostraIban: false,
      });
      await salvaModelloPdf(t.db, "altra", { colore: "#445566" });
      const m = await leggiModelloPdf(t.db, rsId);
      expect(m).toMatchObject({ colore: "#112233", piePagina: "REA 1", mostraIban: false });
      expect((await leggiModelliPdfSalvati(t.db)).altra?.colore).toBe("#445566");
    });
    it("rifiuta colori e loghi non validi", async () => {
      await expect(salvaModelloPdf(t.db, rsId, { colore: "rosso" })).rejects.toThrow();
      await expect(
        salvaModelloPdf(t.db, rsId, { logo: "data:image/webp;base64,UklGRg==" }),
      ).rejects.toThrow();
      expect(await leggiModelliPdfSalvati(t.db)).toEqual({});
    });
    it("senza logo proprio usa quello della configurazione iniziale, se è PNG o JPEG", async () => {
      await t.db.insert(impostazioni).values({ chiave: "azienda.logo", valore: { dataUrl: PNG } });
      expect((await leggiModelloPdf(t.db, rsId)).logo).toBe(PNG);
      await t.db
        .update(impostazioni)
        .set({ valore: { dataUrl: "data:image/webp;base64,UklGRg==" } })
        .where(eq(impostazioni.chiave, "azienda.logo"));
      await salvaModelloPdf(t.db, "senza-logo", {});
      expect((await leggiModelloPdf(t.db, "senza-logo")).logo).toBeNull(); // il WebP non si può usare nei PDF
    });
  });

  describe("dati dei documenti", () => {
    it("un preventivo diventa i dati del PDF, completati con l'anagrafica dell'emittente", async () => {
      const id = await creaPreventivo();
      const d = await datiPdfPreventivo(t.db, id);
      expect(d?.nomeFile).toBe("Preventivo-P-2026-001.pdf");
      expect(d?.ragioneSocialeId).toBe(rsId);
      expect(d?.dati).toMatchObject({
        tipo: "preventivo",
        numero: "P-2026-001",
        scadenza: "2026-12-31",
        oggetto: "Sito vetrina",
        totaleCent: 146400,
        ivaAttiva: true,
        aliquotaIvaBp: 2200,
      });
      // dall'anagrafica attuale: cap, IBAN, PEC che lo snapshot non aveva
      expect(d?.dati.emittente).toMatchObject({
        nome: "MC Digital S.r.l.",
        cap: "24100",
        iban: "IT60X0542811101000000123456",
      });
      expect(d?.dati.cliente).toMatchObject({ nome: "Trattoria Da Marco", codiceSdi: "KRRH6B9" });
      // righe in ordine di posizione e con il tipo di canone
      expect(d?.dati.righe.map((r) => r.descrizione)).toEqual(["Sito web", "Canone hosting"]);
      // il tipo della riga separa le prestazioni dagli abbonamenti nel PDF
      expect(d?.dati.righe[1]?.tipo).toBe("canone_annuo");
    });
    it("una bozza senza numero ha un nome file riconoscibile", async () => {
      const id = await creaPreventivo({ numero: null });
      expect((await datiPdfPreventivo(t.db, id))?.nomeFile).toBe(
        `Preventivo-bozza-${id.slice(0, 8)}.pdf`,
      );
    });
    it("un documento inesistente o eliminato non esiste", async () => {
      expect(await datiPdfPreventivo(t.db, "00000000-0000-4000-8000-000000000000")).toBeNull();
      const id = await creaPreventivo();
      await t.db.update(preventivi).set({ deletedAt: new Date() }).where(eq(preventivi.id, id));
      expect(await datiPdfPreventivo(t.db, id)).toBeNull();
      expect(await datiPdfFattura(t.db, id)).toBeNull();
    });
    it("una fattura porta bollo, ritenuta e netto da pagare", async () => {
      const [f] = await t.db
        .insert(fatture)
        .values({
          ragioneSocialeId: rsId,
          anno: 2026,
          numero: "F-2026-009",
          dataEmissione: "2026-11-02",
          scadenza: "2026-12-02",
          snapshot: {
            emittente: { id: rsId, nome: "MC Digital S.r.l." },
            cliente: { nome: "Cliente occasionale" },
            regole: { ivaAttiva: false, diciturSenzaIva: "Operazione non soggetta a IVA" },
          },
          imponibileCent: 100000,
          bolloCent: 200,
          totaleCent: 100200,
          ritenutaCent: 20000,
          nettoDaPagareCent: 80200,
        })
        .returning();
      await t.db.insert(fatturaRighe).values({
        fatturaId: f?.id ?? "",
        descrizione: "Consulenza",
        prezzoUnitarioCent: 100000,
        importoCent: 100000,
      });
      const d = await datiPdfFattura(t.db, f?.id ?? "");
      expect(d?.nomeFile).toBe("Fattura-F-2026-009.pdf");
      expect(d?.dati).toMatchObject({
        tipo: "fattura",
        ivaAttiva: false,
        diciturSenzaIva: "Operazione non soggetta a IVA",
        ritenutaCent: 20000,
        nettoDaPagareCent: 80200,
        bolloCent: 200,
      });
    });
    it("dal database al PDF: il documento generato contiene i dati veri", async () => {
      await salvaModelloPdf(t.db, rsId, {
        notePreventivo: "Offerta valida 30 giorni.",
        piePagina: "MC Digital · REA BG-1",
      });
      const id = await creaPreventivo();
      const d = await datiPdfPreventivo(t.db, id);
      expect(d).not.toBeNull();
      const pdf = await generaPdf(d!.dati, await leggiModelloPdf(t.db, d!.ragioneSocialeId));
      const testo = await testoDi(pdf);
      for (const atteso of [
        "P-2026-001",
        "Trattoria Da Marco",
        "Sito web",
        "Canone hosting",
        "€ 1.464,00",
        "Offerta valida 30 giorni.",
        "REA BG-1",
        "IT60X0542811101000000123456",
      ])
        expect(testo, atteso).toContain(atteso);
    });
    it("l'anteprima usa i dati della ragione sociale e le sue regole fiscali", async () => {
      const e = await datiPdfEsempio(t.db, rsId, "fattura");
      expect(e?.dati.emittente.nome).toBe("MC Digital S.r.l.");
      expect(e?.dati.totaleCent).toBe(e!.dati.imponibileCent + e!.dati.ivaCent + e!.dati.bolloCent);
      expect(
        await datiPdfEsempio(t.db, "00000000-0000-4000-8000-000000000000", "preventivo"),
      ).toBeNull();
    });
  });
});
