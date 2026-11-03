import { aggiungiMesi } from "@telaio/core";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accettaPreventivo, completaAbbonamentiPreventivo } from "../src/accettazione";
import { creaFatturaDaPreventivo } from "../src/fattura-da-preventivo";
import { oggi } from "../src/rate-abbonamenti";
import {
  abbonamenti,
  clientiRef,
  fatturaRighe,
  fatture,
  preventivi,
  preventivoRighe,
  ragioniSociali,
  rate,
} from "../src/schema";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

const G = "11111111-1111-4111-8111-111111111111";
const REGOLE_IVA = {
  ivaAttiva: true,
  aliquotaIvaBp: 2200,
  bolloAutomatico: false,
  splitPayment: false,
};

type Tipo = "una_tantum" | "canone_annuo" | "canone_mensile";
interface RigaTest {
  descrizione: string;
  tipo: Tipo;
  prezzo: number;
  quantita?: number;
  sconto?: number;
  gruppo?: string;
}

/** Sito 1000, SEO 300 (una tantum); manutenzione 600/anno oppure 60/mese; hosting 50/mese. */
const OFFERTA: RigaTest[] = [
  { descrizione: "Sito web", tipo: "una_tantum", prezzo: 100000 },
  { descrizione: "SEO", tipo: "una_tantum", prezzo: 30000 },
  { descrizione: "Manutenzione — canone annuo", tipo: "canone_annuo", prezzo: 60000, gruppo: G },
  { descrizione: "Manutenzione — canone mensile", tipo: "canone_mensile", prezzo: 6000, gruppo: G },
  { descrizione: "Hosting", tipo: "canone_mensile", prezzo: 5000 },
];

describe.skipIf(!URL_SERVER)("accettazione dei preventivi (Postgres reale)", () => {
  let t: DbTemporaneo;
  let rsId: string;
  let clienteId: string;

  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
    const [rs] = await t.db.insert(ragioniSociali).values({ nome: "MC Digital" }).returning();
    rsId = rs?.id ?? "";
    const [c] = await t.db
      .insert(clientiRef)
      .values({ twentyCompanyId: "tw-1", nome: "Trattoria Da Marco" })
      .returning();
    clienteId = c?.id ?? "";
  });
  afterAll(async () => {
    await t?.elimina();
  });

  async function preventivo(
    righe: RigaTest[] = OFFERTA,
    over: Partial<typeof preventivi.$inferInsert> = {},
    regole: Record<string, unknown> = REGOLE_IVA,
  ) {
    const unaTantum = righe.filter((r) => r.tipo === "una_tantum");
    const imponibile = unaTantum.reduce(
      (s, r) =>
        s +
        (r.quantita ?? 1) * r.prezzo -
        Math.round(((r.quantita ?? 1) * r.prezzo * (r.sconto ?? 0)) / 10000),
      0,
    );
    const [p] = await t.db
      .insert(preventivi)
      .values({
        ragioneSocialeId: rsId,
        clienteRefId: clienteId,
        anno: new Date().getFullYear(),
        numero: "P-1",
        stato: "inviato",
        oggetto: "Offerta",
        snapshot: { emittente: {}, cliente: {}, regole },
        imponibileCent: imponibile,
        ivaCent: Math.round(imponibile * 0.22),
        totaleCent: imponibile + Math.round(imponibile * 0.22),
        ...over,
      })
      .returning();
    const id = p?.id ?? "";
    const inserite = await t.db
      .insert(preventivoRighe)
      .values(
        righe.map((r, i) => {
          const q = r.quantita ?? 1;
          const sc = r.sconto ?? 0;
          return {
            preventivoId: id,
            posizione: i,
            descrizione: r.descrizione,
            tipo: r.tipo,
            quantita: q,
            prezzoUnitarioCent: r.prezzo,
            scontoBp: sc,
            importoCent: q * r.prezzo - Math.round((q * r.prezzo * sc) / 10000),
            gruppoAlternativaId: r.gruppo ?? null,
          };
        }),
      )
      .returning();
    return { id, righe: inserite.sort((a, b) => a.posizione - b.posizione) };
  }

  const stato = async (id: string) =>
    (await t.db.select().from(preventivi).where(eq(preventivi.id, id)))[0];
  const righeDi = async (id: string) =>
    (await t.db.select().from(preventivoRighe).where(eq(preventivoRighe.preventivoId, id))).sort(
      (a, b) => a.posizione - b.posizione,
    );

  describe("accettazione", () => {
    it("totale: tutte le righe accettate, totali accettati uguali all'offerta, abbonamenti creati", async () => {
      const { id, righe } = await preventivo();
      const r = await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
      });
      expect(r.stato).toBe("accettato");
      const p = await stato(id);
      expect(p).toMatchObject({
        stato: "accettato",
        imponibileCent: 130000,
        imponibileAccettatoCent: 130000,
        ivaAccettataCent: 28600,
        totaleAccettatoCent: 158600,
      });
      expect(p?.dataAccettazione).not.toBeNull();
      expect((await righeDi(id)).map((x) => x.accettata)).toEqual([true, true, true, false, true]);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(2);
    });

    it("parziale: una riga esclusa, offerta originale intatta, righe conservate", async () => {
      const { id, righe } = await preventivo();
      const r = await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[0]!.id, righe[4]!.id], gruppi: { [G]: righe[2]!.id } },
      });
      expect(r.stato).toBe("accettato_parzialmente");
      const p = await stato(id);
      expect(p).toMatchObject({
        stato: "accettato_parzialmente",
        imponibileCent: 130000, // offerta originale
        ivaCent: 28600,
        totaleCent: 158600,
        imponibileAccettatoCent: 100000,
        ivaAccettataCent: 22000,
        totaleAccettatoCent: 122000,
      });
      const dopo = await righeDi(id);
      expect(dopo).toHaveLength(5); // nessuna riga eliminata
      expect(dopo[1]).toMatchObject({ descrizione: "SEO", accettata: false, importoCent: 30000 });
      expect(r.righeEscluse).toContain(righe[1]!.id);
    });

    it("parziale con più righe escluse", async () => {
      const { id, righe } = await preventivo();
      const r = await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[0]!.id], gruppi: { [G]: null } },
      });
      expect(r.stato).toBe("accettato_parzialmente");
      expect((await righeDi(id)).map((x) => x.accettata)).toEqual([
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(0);
    });

    it("l'alternativa non scelta non rende parziale un'accettazione altrimenti totale", async () => {
      const { id, righe } = await preventivo();
      const r = await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[3]!.id },
        },
      });
      expect(r.stato).toBe("accettato");
    });

    it("scelta del canone annuale e di quello mensile: un solo abbonamento per gruppo", async () => {
      for (const [indice, periodicita, importo] of [
        [2, "annuale", 60000],
        [3, "mensile", 6000],
      ] as const) {
        await t.db.delete(rate);
        await t.db.delete(abbonamenti);
        const { id, righe } = await preventivo(OFFERTA, { numero: `P-${indice}` });
        await accettaPreventivo(t.db, id, {
          scelta: {
            righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
            gruppi: { [G]: righe[indice]!.id },
          },
        });
        const ab = await t.db.select().from(abbonamenti).where(eq(abbonamenti.preventivoId, id));
        const manutenzione = ab.filter((a) => a.descrizione === "Manutenzione");
        expect(manutenzione).toHaveLength(1);
        expect(manutenzione[0]).toMatchObject({ periodicita, importoRataCent: importo });
        expect(manutenzione[0]?.preventivoRigaId).toBe(righe[indice]!.id);
      }
    });

    it("rifiuta le scelte incoerenti senza cambiare nulla (due alternative, gruppo senza scelta, riga estranea)", async () => {
      const { id, righe } = await preventivo();
      const altro = await preventivo(OFFERTA, { numero: "P-2" });
      const casi = [
        {
          righe: [righe[0]!.id],
          gruppi: { [G]: righe[2]!.id, "22222222-2222-4222-8222-222222222222": null },
        },
        { righe: [righe[0]!.id], gruppi: {} },
        { righe: [righe[0]!.id, righe[2]!.id], gruppi: { [G]: righe[3]!.id } },
        { righe: [altro.righe[0]!.id], gruppi: { [G]: null } },
        { righe: [righe[0]!.id], gruppi: { [G]: altro.righe[2]!.id } },
      ];
      for (const scelta of casi)
        await expect(accettaPreventivo(t.db, id, { scelta })).rejects.toThrow();
      expect((await stato(id))?.stato).toBe("inviato");
      expect((await righeDi(id)).every((x) => x.accettata === null)).toBe(true);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(0);
    });

    it("senza nulla di accettato propone il rifiuto e non cambia lo stato", async () => {
      const { id, righe } = await preventivo();
      await expect(
        accettaPreventivo(t.db, id, { scelta: { righe: [], gruppi: { [G]: null } } }),
      ).rejects.toThrow("rifiuta il preventivo");
      expect((await stato(id))?.stato).toBe("inviato");
      expect(righe).toHaveLength(5);
    });

    it("è possibile solo da inviato o in revisione", async () => {
      const bozza = await preventivo(OFFERTA, { stato: "bozza", numero: null });
      await expect(
        accettaPreventivo(t.db, bozza.id, { scelta: { righe: [], gruppi: {} } }),
      ).rejects.toThrow("Invia il preventivo");
      const rif = await preventivo(OFFERTA, { stato: "rifiutato", numero: "P-9" });
      await expect(
        accettaPreventivo(t.db, rif.id, { scelta: { righe: [], gruppi: {} } }),
      ).rejects.toThrow("già stato chiuso");
      const rev = await preventivo([OFFERTA[0]!], { stato: "in_revisione", numero: "P-8" });
      const r = await accettaPreventivo(t.db, rev.id, {
        scelta: { righe: [rev.righe[0]!.id], gruppi: {} },
      });
      expect(r.stato).toBe("accettato");
    });

    it("canoni accettati senza cliente: errore, e il preventivo resta com'era", async () => {
      const { id, righe } = await preventivo(OFFERTA, { clienteRefId: null });
      await expect(
        accettaPreventivo(t.db, id, {
          scelta: { righe: [righe[0]!.id], gruppi: { [G]: righe[2]!.id } },
        }),
      ).rejects.toThrow("Assegna un cliente");
      expect((await stato(id))?.stato).toBe("inviato");
      // senza canoni il cliente non serve
      const r = await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[0]!.id], gruppi: { [G]: null } },
      });
      expect(r.stato).toBe("accettato_parzialmente");
    });

    it("non si può accettare due volte: la seconda richiesta fallisce senza duplicare nulla", async () => {
      const { id, righe } = await preventivo();
      const scelta = {
        righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
        gruppi: { [G]: righe[2]!.id },
      };
      await accettaPreventivo(t.db, id, { scelta });
      await expect(accettaPreventivo(t.db, id, { scelta })).rejects.toThrow("già stato chiuso");
      expect(await t.db.select().from(abbonamenti)).toHaveLength(2);
    });

    it("richieste concorrenti: una sola accettazione, un solo abbonamento per riga", async () => {
      const { id, righe } = await preventivo();
      const scelta = {
        righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
        gruppi: { [G]: righe[2]!.id },
      };
      const esiti = await Promise.allSettled(
        Array.from({ length: 6 }, () => accettaPreventivo(t.db, id, { scelta })),
      );
      expect(esiti.filter((e) => e.status === "fulfilled")).toHaveLength(1);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(2);
    });

    it("il database impedisce due abbonamenti dalla stessa riga", async () => {
      const { righe } = await preventivo();
      const base = {
        ragioneSocialeId: rsId,
        clienteRefId: clienteId,
        descrizione: "x",
        periodicita: "mensile" as const,
        importoRataCent: 100,
        inizio: "2026-01-01",
        preventivoRigaId: righe[4]!.id,
      };
      await t.db.insert(abbonamenti).values(base);
      await expect(t.db.insert(abbonamenti).values(base)).rejects.toThrow();
      // gli abbonamenti manuali (senza riga) restano illimitati
      await t.db.insert(abbonamenti).values({ ...base, preventivoRigaId: null });
      await t.db.insert(abbonamenti).values({ ...base, preventivoRigaId: null });
    });
  });

  describe("calcoli", () => {
    it("quantità e sconti: importi e abbonamenti", async () => {
      const { id, righe } = await preventivo([
        { descrizione: "Formazione", tipo: "una_tantum", prezzo: 10000, quantita: 3, sconto: 1000 },
        { descrizione: "Licenze", tipo: "canone_mensile", prezzo: 2000, quantita: 5, sconto: 1000 },
      ]);
      await accettaPreventivo(t.db, id, { scelta: { righe: righe.map((r) => r.id), gruppi: {} } });
      expect((await stato(id))?.imponibileAccettatoCent).toBe(27000);
      const [ab] = await t.db.select().from(abbonamenti);
      expect(ab).toMatchObject({
        periodicita: "mensile",
        importoRataCent: 9000,
        descrizione: "Licenze",
      });
    });

    it("il bollo si ricalcola sulle righe accettate (regime senza IVA)", async () => {
      const regime = { ...REGOLE_IVA, ivaAttiva: false, bolloAutomatico: true };
      const { id, righe } = await preventivo(
        [
          { descrizione: "Grande", tipo: "una_tantum", prezzo: 100000 },
          { descrizione: "Piccola", tipo: "una_tantum", prezzo: 5000 },
        ],
        { bolloCent: 200, totaleCent: 105200 },
        regime,
      );
      await accettaPreventivo(t.db, id, { scelta: { righe: [righe[1]!.id], gruppi: {} } });
      expect(await stato(id)).toMatchObject({
        bolloCent: 200, // originale
        bolloAccettatoCent: 0,
        totaleAccettatoCent: 5000,
        imponibileAccettatoCent: 5000,
      });
    });

    it("i canoni non finiscono nei totali accettati", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[3]!.id },
        },
      });
      expect((await stato(id))?.imponibileAccettatoCent).toBe(130000);
    });
  });

  describe("abbonamenti e rate", () => {
    it("decorrenza di default: oggi; le rate partono da lì e riutilizzano il meccanismo esistente", async () => {
      const { id, righe } = await preventivo();
      const r = await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[3]!.id },
        },
      });
      expect(r.decorrenza).toBe(oggi());
      expect(r.rateGenerate).toBe(true);
      const ab = await t.db.select().from(abbonamenti);
      expect(ab.every((a) => a.inizio === oggi() && a.stato === "attivo")).toBe(true);
      const mensile = ab.find((a) => a.descrizione === "Hosting");
      const rateMensili = await t.db
        .select()
        .from(rate)
        .where(eq(rate.abbonamentoId, mensile?.id ?? ""));
      expect(rateMensili.length).toBeGreaterThanOrEqual(12);
      expect(rateMensili.every((x) => x.importoCent === 5000)).toBe(true);
    });

    it("decorrenza personalizzata (futura) applicata a tutti gli abbonamenti del preventivo", async () => {
      const { id, righe } = await preventivo();
      const futura = aggiungiMesi(oggi(), 2);
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
        decorrenza: futura,
      });
      const ab = await t.db.select().from(abbonamenti);
      expect(ab.map((a) => a.inizio)).toEqual([futura, futura]);
      const prima = await t.db.select().from(rate).orderBy(rate.scadenza);
      expect(prima[0]?.scadenza).toBe(futura);
    });

    it("rifiuta una decorrenza nel passato o non valida, senza accettare", async () => {
      const { id, righe } = await preventivo();
      const scelta = {
        righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
        gruppi: { [G]: righe[2]!.id },
      };
      await expect(
        accettaPreventivo(t.db, id, { scelta, decorrenza: "2020-01-01" }),
      ).rejects.toThrow("passato");
      await expect(accettaPreventivo(t.db, id, { scelta, decorrenza: "boh" })).rejects.toThrow();
      expect((await stato(id))?.stato).toBe("inviato");
    });

    it("completaAbbonamentiPreventivo è idempotente e recupera le rate mancanti", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
      });
      const nRate = (await t.db.select().from(rate)).length;
      // simula un fallimento nella generazione delle rate
      await t.db.delete(rate);
      const r = await completaAbbonamentiPreventivo(t.db, id);
      expect(r.abbonamentiCreati).toEqual([]);
      expect(r.rateGenerate).toBe(true);
      expect((await t.db.select().from(rate)).length).toBe(nRate);
      await completaAbbonamentiPreventivo(t.db, id);
      expect((await t.db.select().from(rate)).length).toBe(nRate);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(2);
    });

    it("un abbonamento eliminato (soft delete) o cessato non viene ricreato né riattivato, e non nascono duplicati", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
      });
      const ab = await t.db.select().from(abbonamenti).where(eq(abbonamenti.preventivoId, id));
      expect(ab).toHaveLength(2);
      const eliminato = ab.find((a) => a.descrizione === "Hosting")!;
      const cessato = ab.find((a) => a.descrizione === "Manutenzione")!;
      await t.db.delete(rate).where(eq(rate.abbonamentoId, eliminato.id));
      await t.db
        .update(abbonamenti)
        .set({ deletedAt: new Date() })
        .where(eq(abbonamenti.id, eliminato.id));
      await t.db
        .update(abbonamenti)
        .set({ stato: "cessato" })
        .where(eq(abbonamenti.id, cessato.id));
      await t.db.delete(rate).where(eq(rate.abbonamentoId, cessato.id));

      const r = await completaAbbonamentiPreventivo(t.db, id);
      // il vincolo sulla riga resta anche con il record eliminato: nessuna riga genera un secondo abbonamento
      expect(r.abbonamentiCreati).toEqual([]);
      const dopo = await t.db.select().from(abbonamenti).where(eq(abbonamenti.preventivoId, id));
      expect(dopo).toHaveLength(2);
      expect(dopo.find((a) => a.id === cessato.id)?.stato).toBe("cessato"); // non riattivato
      // nessuna rata rigenerata per l'abbonamento eliminato né per quello cessato
      expect(await t.db.select().from(rate)).toHaveLength(0);
      // a livello di database lo stesso: un secondo abbonamento per la stessa riga è impossibile
      await expect(
        t.db.insert(abbonamenti).values({
          ragioneSocialeId: rsId,
          clienteRefId: clienteId,
          descrizione: "doppione",
          periodicita: "mensile",
          importoRataCent: 1,
          inizio: oggi(),
          preventivoRigaId: eliminato.preventivoRigaId,
        }),
      ).rejects.toThrow();
    });

    it("per un preventivo già accettato (storico) crea gli abbonamenti mancanti solo dalle righe accettate", async () => {
      const { id, righe } = await preventivo(OFFERTA, { stato: "accettato" });
      await t.db
        .update(preventivoRighe)
        .set({ accettata: true })
        .where(eq(preventivoRighe.id, righe[4]!.id));
      const r = await completaAbbonamentiPreventivo(t.db, id);
      expect(r.abbonamentiCreati).toHaveLength(1);
      const [ab] = await t.db.select().from(abbonamenti);
      expect(ab?.descrizione).toBe("Hosting");
      await expect(
        completaAbbonamentiPreventivo(t.db, (await preventivo(OFFERTA, { numero: "P-7" })).id),
      ).rejects.toThrow("non è stato accettato");
    });
  });

  describe("fatture da preventivo", () => {
    it("accettazione totale: fattura con tutte le righe una tantum, senza canoni", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
      });
      const { id: fid } = await creaFatturaDaPreventivo(t.db, id);
      const [f] = await t.db.select().from(fatture).where(eq(fatture.id, fid));
      expect(f).toMatchObject({
        origine: "preventivo",
        preventivoId: id,
        imponibileCent: 130000,
        ivaCent: 28600,
        totaleCent: 158600,
      });
      const fr = await t.db.select().from(fatturaRighe).where(eq(fatturaRighe.fatturaId, fid));
      expect(fr.map((x) => x.descrizione).sort()).toEqual(["SEO", "Sito web"]);
    });

    it("accettazione parziale: solo le righe accettate, totali ricalcolati, descrizioni e prezzi originali", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[0]!.id, righe[4]!.id], gruppi: { [G]: righe[3]!.id } },
      });
      const { id: fid } = await creaFatturaDaPreventivo(t.db, id);
      const [f] = await t.db.select().from(fatture).where(eq(fatture.id, fid));
      expect(f).toMatchObject({ imponibileCent: 100000, ivaCent: 22000, totaleCent: 122000 });
      const fr = await t.db.select().from(fatturaRighe).where(eq(fatturaRighe.fatturaId, fid));
      expect(fr).toHaveLength(1);
      expect(fr[0]).toMatchObject({
        descrizione: "Sito web",
        prezzoUnitarioCent: 100000,
        importoCent: 100000,
      });
    });

    it("ritenuta e split payment sulla fattura di un'accettazione parziale", async () => {
      const regime = { ...REGOLE_IVA, ritenutaBp: 2000, splitPayment: true };
      const { id, righe } = await preventivo(OFFERTA, {}, regime);
      await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[0]!.id], gruppi: { [G]: null } },
      });
      const { id: fid } = await creaFatturaDaPreventivo(t.db, id);
      const [f] = await t.db.select().from(fatture).where(eq(fatture.id, fid));
      expect(f).toMatchObject({
        imponibileCent: 100000,
        ritenutaCent: 20000,
        ivaSplitCent: 22000,
        nettoDaPagareCent: 100000 + 22000 - 20000 - 22000,
      });
    });

    it("niente fattura vuota se resta solo un abbonamento; non si fattura un preventivo non accettato", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: { righe: [righe[4]!.id], gruppi: { [G]: null } },
      });
      await expect(creaFatturaDaPreventivo(t.db, id)).rejects.toThrow(
        "Nessuna prestazione una tantum accettata",
      );
      expect(await t.db.select().from(fatture)).toHaveLength(0);
      expect(await t.db.select().from(abbonamenti)).toHaveLength(1); // gli abbonamenti restano gestibili

      const inviato = await preventivo(OFFERTA, { numero: "P-5" });
      await expect(creaFatturaDaPreventivo(t.db, inviato.id)).rejects.toThrow(
        "solo un preventivo accettato",
      );
    });

    it("una sola fattura per preventivo, anche con richieste concorrenti e a livello di database", async () => {
      const { id, righe } = await preventivo();
      await accettaPreventivo(t.db, id, {
        scelta: {
          righe: [righe[0]!.id, righe[1]!.id, righe[4]!.id],
          gruppi: { [G]: righe[2]!.id },
        },
      });
      const esiti = await Promise.allSettled(
        Array.from({ length: 5 }, () => creaFatturaDaPreventivo(t.db, id)),
      );
      expect(esiti.filter((e) => e.status === "fulfilled")).toHaveLength(1);
      expect(await t.db.select().from(fatture).where(eq(fatture.preventivoId, id))).toHaveLength(1);
      await expect(creaFatturaDaPreventivo(t.db, id)).rejects.toThrow("ha già una fattura");
      await expect(
        t.db.insert(fatture).values({
          ragioneSocialeId: rsId,
          origine: "preventivo",
          preventivoId: id,
          anno: 2026,
          snapshot: { emittente: {}, cliente: {}, regole: {} },
        }),
      ).rejects.toThrow();
      // una fattura eliminata libera il preventivo (vincolo parziale)
      await t.db.update(fatture).set({ deletedAt: new Date() }).where(eq(fatture.preventivoId, id));
      await creaFatturaDaPreventivo(t.db, id);
    });

    it("le righe di preventivi accettati prima di questa funzione, senza decisione, non si fatturano", async () => {
      const { id } = await preventivo(OFFERTA, { stato: "accettato" });
      await expect(creaFatturaDaPreventivo(t.db, id)).rejects.toThrow(
        "Nessuna prestazione una tantum accettata",
      );
      expect(
        await t.db
          .select()
          .from(preventivoRighe)
          .where(and(eq(preventivoRighe.preventivoId, id), eq(preventivoRighe.accettata, true))),
      ).toHaveLength(0);
    });
  });
});
