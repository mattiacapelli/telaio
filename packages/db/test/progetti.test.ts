import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accettaPreventivo } from "../src/accettazione";
import {
  aggiungiRisorsa,
  cambiaStatoProgetto,
  creaProgetto,
  creaProgettoDaPreventivo,
  eliminaRisorsa,
  modificaProgetto,
  modificaRisorsa,
  progettiDelPreventivo,
} from "../src/progetti";
import {
  clientiRef,
  preventivi,
  preventivoRighe,
  progetti,
  progettoRisorse,
  ragioniSociali,
  users,
} from "../src/schema";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

describe.skipIf(!URL_SERVER)("modulo Progetti (Postgres reale)", () => {
  let t: DbTemporaneo;
  let rsId: string;
  let clienteId: string;
  let altroClienteId: string;

  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
    const [rs] = await t.db.insert(ragioniSociali).values({ nome: "MC Digital" }).returning();
    rsId = rs?.id ?? "";
    const [c1, c2] = await t.db
      .insert(clientiRef)
      .values([
        { twentyCompanyId: "tw-1", nome: "Trattoria Da Marco" },
        { twentyCompanyId: "tw-2", nome: "Studio Bianchi" },
      ])
      .returning();
    clienteId = c1?.id ?? "";
    altroClienteId = c2?.id ?? "";
    await t.db.insert(users).values({ id: "u1", name: "Mattia", email: "m@telaio.local" });
  });
  afterAll(async () => {
    await t?.elimina();
  });

  /**
   * Un preventivo con le sue righe una tantum: `accettate` dice come sono state decise (true = accettata,
   * false = esclusa, null = nessuna decisione). Di norma i preventivi accettati hanno una riga accettata.
   */
  async function preventivo(
    stato: "bozza" | "inviato" | "accettato" | "accettato_parzialmente" | "rifiutato" = "accettato",
    cliente: string | null = clienteId,
    accettate: (boolean | null)[] = stato.startsWith("accettato") ? [true] : [],
  ) {
    const [p] = await t.db
      .insert(preventivi)
      .values({
        ragioneSocialeId: rsId,
        clienteRefId: cliente,
        anno: 2026,
        stato,
        oggetto: "Sito vetrina",
        snapshot: { emittente: {}, cliente: {}, regole: {} },
      })
      .returning();
    const id = p?.id ?? "";
    if (accettate.length > 0)
      await t.db.insert(preventivoRighe).values(
        accettate.map((accettata, i) => ({
          preventivoId: id,
          posizione: i,
          descrizione: `Prestazione ${i + 1}`,
          tipo: "una_tantum" as const,
          prezzoUnitarioCent: 10000,
          importoCent: 10000,
          accettata,
        })),
      );
    return id;
  }

  describe("creazione manuale", () => {
    it("crea un progetto con valori predefiniti, codice generato e cliente associato", async () => {
      const r = await creaProgetto(t.db, { dati: { nome: "Gestionale" }, clienteRefId: clienteId });
      expect(r.codice).toBe(`PRJ-${new Date().getFullYear()}-001`);
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, r.id));
      expect(p).toMatchObject({
        nome: "Gestionale",
        stato: "pianificato",
        priorita: "normale",
        categoria: "altro",
        clienteRefId: clienteId,
        preventivoId: null,
        dataInizioEffettiva: null,
        deletedAt: null,
      });
    });
    it("i codici sono progressivi e unici, anche in parallelo", async () => {
      const r = await Promise.all(
        Array.from({ length: 8 }, (_, i) => creaProgetto(t.db, { dati: { nome: `P${i}` } })),
      );
      const codici = r.map((x) => x.codice).sort();
      expect(new Set(codici).size).toBe(8);
      expect(codici[0]).toMatch(/-001$/);
      expect(codici[7]).toMatch(/-008$/);
    });
    it("valida i dati e il responsabile", async () => {
      await expect(creaProgetto(t.db, { dati: { nome: "" } })).rejects.toThrow();
      await expect(
        creaProgetto(t.db, { dati: { nome: "X", responsabileId: "inesistente" } }),
      ).rejects.toThrow("responsabile");
      const ok = await creaProgetto(t.db, { dati: { nome: "X", responsabileId: "u1" } });
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, ok.id));
      expect(p?.responsabileId).toBe("u1");
      expect(await t.db.select().from(progetti)).toHaveLength(1);
    });
    it("un errore non consuma il codice: nessun buco nella numerazione", async () => {
      await expect(
        creaProgetto(t.db, { dati: { nome: "X", responsabileId: "boh" } }),
      ).rejects.toThrow();
      const r = await creaProgetto(t.db, { dati: { nome: "Y" } });
      expect(r.codice).toMatch(/-001$/);
    });
  });

  describe("modifica e stato", () => {
    it("modifica i campi e lascia invariati cliente e preventivo se non passati", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" }, clienteRefId: clienteId });
      const esito = await modificaProgetto(t.db, id, {
        dati: { nome: "B", categoria: "sito_web", priorita: "alta", descrizione: "desc" },
      });
      expect(esito.cambioStato).toBeNull();
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, id));
      expect(p).toMatchObject({
        nome: "B",
        categoria: "sito_web",
        priorita: "alta",
        clienteRefId: clienteId,
      });
    });
    it("cambia e rimuove il cliente quando richiesto", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" }, clienteRefId: clienteId });
      await modificaProgetto(t.db, id, { dati: { nome: "A" }, clienteRefId: altroClienteId });
      expect((await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.clienteRefId).toBe(
        altroClienteId,
      );
      await modificaProgetto(t.db, id, { dati: { nome: "A" }, clienteRefId: null });
      expect(
        (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.clienteRefId,
      ).toBeNull();
    });
    it("segnala il cambio di stato e aggiorna le date effettive", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      const a = await modificaProgetto(t.db, id, { dati: { nome: "A", stato: "in_corso" } });
      expect(a.cambioStato).toEqual({ da: "pianificato", a: "in_corso" });
      const [p1] = await t.db.select().from(progetti).where(eq(progetti.id, id));
      expect(p1?.dataInizioEffettiva).not.toBeNull();
      expect(p1?.dataFineEffettiva).toBeNull();

      expect(await cambiaStatoProgetto(t.db, id, "completato")).toEqual({
        da: "in_corso",
        a: "completato",
      });
      const [p2] = await t.db.select().from(progetti).where(eq(progetti.id, id));
      expect(p2?.dataFineEffettiva).not.toBeNull();
      expect(p2?.dataInizioEffettiva).toBe(p1?.dataInizioEffettiva);

      expect(await cambiaStatoProgetto(t.db, id, "completato")).toBeNull();
      await cambiaStatoProgetto(t.db, id, "in_attesa");
      expect(
        (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.dataFineEffettiva,
      ).toBeNull();
    });
    it("aggiorna updated_at e rifiuta progetti inesistenti", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      const prima = (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.updatedAt;
      await new Promise((r) => setTimeout(r, 15));
      await cambiaStatoProgetto(t.db, id, "in_attesa");
      const dopo = (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.updatedAt;
      expect((dopo?.getTime() ?? 0) > (prima?.getTime() ?? 0)).toBe(true);
      const zero = "00000000-0000-0000-0000-000000000000";
      await expect(cambiaStatoProgetto(t.db, zero, "in_corso")).rejects.toThrow("non trovato");
      await expect(modificaProgetto(t.db, zero, { dati: { nome: "x" } })).rejects.toThrow(
        "non trovato",
      );
    });
  });

  describe("preventivo", () => {
    it("da un preventivo accettato: nome dall'oggetto, cliente ereditato, stato e priorità iniziali", async () => {
      const pid = await preventivo();
      const r = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} });
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, r.id));
      expect(p).toMatchObject({
        nome: "Sito vetrina",
        clienteRefId: clienteId,
        preventivoId: pid,
        stato: "pianificato",
        priorita: "normale",
      });
    });
    it("accetta nome e categoria scelti dall'utente", async () => {
      const pid = await preventivo();
      const r = await creaProgettoDaPreventivo(t.db, {
        preventivoId: pid,
        dati: { nome: "Nuovo sito Rossi", categoria: "ecommerce" },
      });
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, r.id));
      expect(p).toMatchObject({ nome: "Nuovo sito Rossi", categoria: "ecommerce" });
    });
    it("un preventivo può generare più progetti, ognuno col suo codice", async () => {
      const pid = await preventivo();
      const a = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: "Sito" } });
      const b = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: "App" } });
      expect(a.id).not.toBe(b.id);
      expect(a.codice).not.toBe(b.codice);
      const trovati = await progettiDelPreventivo(t.db, pid);
      expect(trovati.map((x) => x.nome)).toEqual(["Sito", "App"]);
    });
    it("richieste concorrenti sullo stesso preventivo producono progetti distinti e codici unici", async () => {
      const pid = await preventivo();
      const r = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: `P${i}` } }),
        ),
      );
      expect(new Set(r.map((x) => x.id)).size).toBe(6);
      expect(new Set(r.map((x) => x.codice)).size).toBe(6);
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(6);
    });
    it("anche il database ammette più progetti sullo stesso preventivo", async () => {
      const pid = await preventivo();
      await t.db.insert(progetti).values({ codice: "A", nome: "A", preventivoId: pid });
      await t.db.insert(progetti).values({ codice: "B", nome: "B", preventivoId: pid });
      await t.db.insert(progetti).values({ codice: "C", nome: "C" });
      await expect(
        t.db.insert(progetti).values({ codice: "A", nome: "doppio codice" }),
      ).rejects.toThrow();
    });
    it("la creazione manuale può collegare un preventivo già usato da un altro progetto", async () => {
      const pid = await preventivo();
      await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} });
      const r = await creaProgetto(t.db, { dati: { nome: "Secondo" }, preventivoId: pid });
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(2);
      expect(r.id).toBeTruthy();
    });
    it("rifiuta preventivi non accettati o inesistenti, senza lasciare progetti né buchi di codice", async () => {
      for (const stato of ["bozza", "rifiutato"] as const) {
        const pid = await preventivo(stato);
        await expect(
          creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} }),
        ).rejects.toThrow("solo da un preventivo accettato");
      }
      await expect(
        creaProgettoDaPreventivo(t.db, {
          preventivoId: "00000000-0000-0000-0000-000000000000",
          dati: {},
        }),
      ).rejects.toThrow("non trovato");
      expect(await t.db.select().from(progetti)).toHaveLength(0);
      const ok = await creaProgetto(t.db, { dati: { nome: "X" } });
      expect(ok.codice).toMatch(/-001$/);
    });
    it("un preventivo eliminato non genera progetti", async () => {
      const pid = await preventivo();
      await t.db.update(preventivi).set({ deletedAt: new Date() }).where(eq(preventivi.id, pid));
      await expect(creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} })).rejects.toThrow(
        "non trovato",
      );
    });
    it("collega un preventivo in modifica; solo se accettato", async () => {
      const pid = await preventivo();
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      await modificaProgetto(t.db, id, { dati: { nome: "A" }, preventivoId: pid });
      expect(await progettiDelPreventivo(t.db, pid)).toMatchObject([{ id }]);
      // risalvare con lo stesso preventivo non lo ricontrolla né fallisce
      await modificaProgetto(t.db, id, { dati: { nome: "A2" }, preventivoId: pid });
      const altro = await creaProgetto(t.db, { dati: { nome: "B" } });
      await modificaProgetto(t.db, altro.id, { dati: { nome: "B" }, preventivoId: pid });
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(2);
      const bozza = await preventivo("bozza");
      await expect(
        modificaProgetto(t.db, altro.id, { dati: { nome: "B" }, preventivoId: bozza }),
      ).rejects.toThrow("accettato");
      await modificaProgetto(t.db, altro.id, { dati: { nome: "B" }, preventivoId: null });
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(1);
    });
  });

  describe("integrazione con l'accettazione dei preventivi", () => {
    it("da un preventivo accettato parzialmente si crea il progetto, collegato all'originale", async () => {
      const pid = await preventivo("accettato_parzialmente", clienteId, [true, false]);
      const r = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} });
      const [p] = await t.db.select().from(progetti).where(eq(progetti.id, r.id));
      expect(p).toMatchObject({
        preventivoId: pid,
        clienteRefId: clienteId,
        nome: "Sito vetrina",
        stato: "pianificato",
        priorita: "normale",
      });
      expect(await progettiDelPreventivo(t.db, pid)).toMatchObject([{ id: r.id }]);
    });

    it("non copia né altera le righe del preventivo: accettate ed escluse restano com'erano", async () => {
      const pid = await preventivo("accettato_parzialmente", clienteId, [true, false, true]);
      await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} });
      const righe = await t.db
        .select()
        .from(preventivoRighe)
        .where(eq(preventivoRighe.preventivoId, pid))
        .orderBy(preventivoRighe.posizione);
      expect(righe.map((r) => [r.accettata, r.importoCent])).toEqual([
        [true, 10000],
        [false, 10000],
        [true, 10000],
      ]);
      // il progetto tiene solo il riferimento: nessuna riga economica, nessun abbonamento
      expect(await t.db.select().from(preventivoRighe)).toHaveLength(3);
    });

    it("serve almeno una prestazione accettata, sia da accettato sia da accettato parzialmente", async () => {
      for (const stato of ["accettato", "accettato_parzialmente"] as const) {
        const nessuna = await preventivo(stato, clienteId, [false, false]);
        await expect(
          creaProgettoDaPreventivo(t.db, { preventivoId: nessuna, dati: {} }),
        ).rejects.toThrow("Nessuna prestazione accettata");
        const senzaDecisione = await preventivo(stato, clienteId, [null]);
        await expect(
          creaProgetto(t.db, { dati: { nome: "X" }, preventivoId: senzaDecisione }),
        ).rejects.toThrow("Nessuna prestazione accettata");
        const senzaRighe = await preventivo(stato, clienteId, []);
        await expect(
          creaProgettoDaPreventivo(t.db, { preventivoId: senzaRighe, dati: {} }),
        ).rejects.toThrow("Nessuna prestazione accettata");
      }
      expect(await t.db.select().from(progetti)).toHaveLength(0);
      expect((await creaProgetto(t.db, { dati: { nome: "Y" } })).codice).toMatch(/-001$/);
    });

    it("basta una riga accettata, anche un solo abbonamento", async () => {
      const pid = await preventivo("accettato_parzialmente", clienteId, [false]);
      await t.db.insert(preventivoRighe).values({
        preventivoId: pid,
        posizione: 1,
        descrizione: "Hosting",
        tipo: "canone_mensile",
        prezzoUnitarioCent: 5000,
        importoCent: 5000,
        accettata: true,
      });
      await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} });
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(1);
    });

    it("preventivi inviati, rifiutati o in bozza non generano progetti, nemmeno con righe", async () => {
      for (const stato of ["bozza", "inviato", "rifiutato"] as const) {
        const pid = await preventivo(stato, clienteId, [true]);
        await expect(
          creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: {} }),
        ).rejects.toThrow("preventivo accettato");
      }
      expect(await t.db.select().from(progetti)).toHaveLength(0);
    });

    it("più progetti dallo stesso preventivo parziale, con codici distinti e nessun duplicato involontario", async () => {
      const pid = await preventivo("accettato_parzialmente", clienteId, [true, false]);
      const a = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: "Sito" } });
      const b = await creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: "SEO" } });
      expect(a.codice).not.toBe(b.codice);
      const parallelo = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          creaProgettoDaPreventivo(t.db, { preventivoId: pid, dati: { nome: `P${i}` } }),
        ),
      );
      expect(new Set(parallelo.map((x) => x.codice)).size).toBe(4);
      expect(await progettiDelPreventivo(t.db, pid)).toHaveLength(6);
    });

    it("il cliente si eredita dal preventivo parziale; senza cliente il progetto resta senza", async () => {
      const senza = await preventivo("accettato_parzialmente", null, [true]);
      const r = await creaProgettoDaPreventivo(t.db, { preventivoId: senza, dati: {} });
      expect(
        (await t.db.select().from(progetti).where(eq(progetti.id, r.id)))[0]?.clienteRefId,
      ).toBeNull();
    });

    it("collegare in modifica un preventivo parziale funziona solo se ha prestazioni accettate", async () => {
      const buono = await preventivo("accettato_parzialmente", clienteId, [true, false]);
      const vuoto = await preventivo("accettato_parzialmente", clienteId, [false]);
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      await modificaProgetto(t.db, id, { dati: { nome: "A" }, preventivoId: buono });
      await expect(
        modificaProgetto(t.db, id, { dati: { nome: "A" }, preventivoId: vuoto }),
      ).rejects.toThrow("Nessuna prestazione accettata");
      expect(await progettiDelPreventivo(t.db, buono)).toHaveLength(1);
    });

    it("dopo un'accettazione parziale vera (transazione completa) il progetto si crea e le righe restano intatte", async () => {
      const [p] = await t.db
        .insert(preventivi)
        .values({
          ragioneSocialeId: rsId,
          clienteRefId: clienteId,
          anno: 2026,
          stato: "inviato",
          numero: "P-1",
          oggetto: "Sito e SEO",
          snapshot: {
            emittente: {},
            cliente: {},
            regole: {
              ivaAttiva: true,
              aliquotaIvaBp: 2200,
              bolloAutomatico: false,
              splitPayment: false,
            },
          },
          imponibileCent: 130000,
          ivaCent: 28600,
          totaleCent: 158600,
        })
        .returning();
      const righe = await t.db
        .insert(preventivoRighe)
        .values([
          {
            preventivoId: p!.id,
            posizione: 0,
            descrizione: "Sito",
            tipo: "una_tantum",
            prezzoUnitarioCent: 100000,
            importoCent: 100000,
          },
          {
            preventivoId: p!.id,
            posizione: 1,
            descrizione: "SEO",
            tipo: "una_tantum",
            prezzoUnitarioCent: 30000,
            importoCent: 30000,
          },
        ])
        .returning();
      const esito = await accettaPreventivo(t.db, p!.id, {
        scelta: { righe: [righe[0]!.id], gruppi: {} },
      });
      expect(esito.stato).toBe("accettato_parzialmente");

      const r = await creaProgettoDaPreventivo(t.db, { preventivoId: p!.id, dati: {} });
      expect((await t.db.select().from(progetti).where(eq(progetti.id, r.id)))[0]).toMatchObject({
        preventivoId: p!.id,
        nome: "Sito e SEO",
      });
      const dopo = await t.db
        .select()
        .from(preventivoRighe)
        .where(eq(preventivoRighe.preventivoId, p!.id))
        .orderBy(preventivoRighe.posizione);
      expect(dopo.map((x) => [x.descrizione, x.accettata])).toEqual([
        ["Sito", true],
        ["SEO", false],
      ]);
      expect(
        (await t.db.select().from(preventivi).where(eq(preventivi.id, p!.id)))[0],
      ).toMatchObject({
        stato: "accettato_parzialmente",
        totaleCent: 158600, // offerta originale intatta
        imponibileAccettatoCent: 100000,
      });
    });
  });

  describe("risorse", () => {
    const base = { tipo: "repository", titolo: "Repo", url: "https://github.com/o/r" };

    it("crea, modifica ed elimina una risorsa", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      const r = await aggiungiRisorsa(t.db, id, {
        ...base,
        ambiente: "production",
        descrizione: "main",
      });
      let [riga] = await t.db.select().from(progettoRisorse).where(eq(progettoRisorse.id, r.id));
      expect(riga).toMatchObject({
        progettoId: id,
        tipo: "repository",
        ambiente: "production",
        ordine: 0,
      });

      await modificaRisorsa(t.db, r.id, {
        ...base,
        titolo: "Repo nuovo",
        tipo: "design",
        url: "https://figma.com/x",
      });
      [riga] = await t.db.select().from(progettoRisorse).where(eq(progettoRisorse.id, r.id));
      expect(riga).toMatchObject({
        titolo: "Repo nuovo",
        tipo: "design",
        url: "https://figma.com/x",
        ambiente: null,
      });

      expect(await eliminaRisorsa(t.db, r.id)).toMatchObject({
        progettoId: id,
        titolo: "Repo nuovo",
      });
      expect(await t.db.select().from(progettoRisorse)).toHaveLength(0);
      await expect(eliminaRisorsa(t.db, r.id)).rejects.toThrow("non trovata");
    });
    it("rifiuta URL non http/https o con credenziali, e non scrive nulla", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      for (const url of [
        "javascript:alert(1)",
        "ftp://x.it/f",
        "https://u:p@host.it",
        "non un url",
      ])
        await expect(aggiungiRisorsa(t.db, id, { ...base, url })).rejects.toThrow();
      expect(await t.db.select().from(progettoRisorse)).toHaveLength(0);
    });
    it("l'ordine cresce e c'è al più una risorsa principale", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      const a = await aggiungiRisorsa(t.db, id, { ...base, titolo: "A", principale: true });
      const b = await aggiungiRisorsa(t.db, id, { ...base, titolo: "B" });
      const c = await aggiungiRisorsa(t.db, id, { ...base, titolo: "C", principale: true });
      const righe = await t.db
        .select()
        .from(progettoRisorse)
        .where(eq(progettoRisorse.progettoId, id));
      expect(righe.sort((x, y) => x.ordine - y.ordine).map((r) => r.ordine)).toEqual([0, 1, 2]);
      expect(righe.filter((r) => r.principale).map((r) => r.id)).toEqual([c.id]);
      await modificaRisorsa(t.db, b.id, { ...base, titolo: "B", principale: true });
      const dopo = await t.db
        .select()
        .from(progettoRisorse)
        .where(and(eq(progettoRisorse.progettoId, id), eq(progettoRisorse.principale, true)));
      expect(dopo.map((r) => r.id)).toEqual([b.id]);
      expect(a.id).not.toBe(b.id);
    });
    it("il database impedisce due principali nello stesso progetto", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      await t.db
        .insert(progettoRisorse)
        .values({ progettoId: id, titolo: "x", url: "https://a.it", principale: true });
      await expect(
        t.db
          .insert(progettoRisorse)
          .values({ progettoId: id, titolo: "y", url: "https://b.it", principale: true }),
      ).rejects.toThrow();
    });
    it("tocca l'aggiornamento del progetto e non funziona su progetti inesistenti", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      const prima = (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.updatedAt;
      await new Promise((r) => setTimeout(r, 15));
      await aggiungiRisorsa(t.db, id, base);
      const dopo = (await t.db.select().from(progetti).where(eq(progetti.id, id)))[0]?.updatedAt;
      expect((dopo?.getTime() ?? 0) > (prima?.getTime() ?? 0)).toBe(true);
      await expect(
        aggiungiRisorsa(t.db, "00000000-0000-0000-0000-000000000000", base),
      ).rejects.toThrow("non trovato");
    });
    it("eliminare il progetto a livello DB porta via le risorse (cascade)", async () => {
      const { id } = await creaProgetto(t.db, { dati: { nome: "A" } });
      await aggiungiRisorsa(t.db, id, base);
      await t.db.delete(progetti).where(eq(progetti.id, id));
      expect(await t.db.select().from(progettoRisorse)).toHaveLength(0);
    });
  });
});
