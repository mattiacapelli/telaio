import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { datiPdfOre } from "../src/documenti-pdf";
import {
  aggiornaTimer,
  avviaTimer,
  cambiaStatoMonteOre,
  creaMonteOre,
  elencaTempo,
  eliminaMonteOre,
  eliminaTempo,
  fermaTimer,
  minutiNelPeriodo,
  modificaMonteOre,
  modificaTempo,
  registraOreExtraFatturate,
  registraTempo,
  riepilogoMonteOre,
  scartaTimer,
  tempoRecente,
  timerAttivo,
} from "../src/ore";
import { creaProgetto } from "../src/progetti";
import { clientiRef, fatture, ragioniSociali } from "../src/schema";
import { creaTicket } from "../src/ticket";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

describe.skipIf(!URL_SERVER)("monte ore e tempo (Postgres reale)", () => {
  let t: DbTemporaneo;
  let clienteId: string;
  let altroClienteId: string;
  let rsId: string;

  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
    const [a, b] = await t.db
      .insert(clientiRef)
      .values([
        { twentyCompanyId: "tw-1", nome: "Trattoria" },
        { twentyCompanyId: "tw-2", nome: "Studio" },
      ])
      .returning();
    const [rs] = await t.db.insert(ragioniSociali).values({ nome: "MC Digital" }).returning();
    rsId = rs?.id ?? "";
    clienteId = a?.id ?? "";
    altroClienteId = b?.id ?? "";
  });
  afterAll(async () => {
    await t?.elimina();
  });

  const contratto = (over: Record<string, unknown> = {}) =>
    creaMonteOre(t.db, {
      clienteRefId: clienteId,
      ragioneSocialeId: rsId,
      dati: { nome: "Assistenza", minutiIncluse: 600, dataInizio: "2026-01-15", ...over },
    });

  describe("contratti", () => {
    it("si crea con i valori predefiniti e si rifiuta cliente o dati sbagliati", async () => {
      const { id } = await contratto();
      const [r] = await riepilogoMonteOre(t.db, "2026-01-20");
      expect(r?.contratto).toMatchObject({
        id,
        arrotondamentoMinuti: 15,
        stato: "attivo",
        minutiIncluse: 600,
      });
      expect(r?.cliente).toBe("Trattoria");
      await expect(
        creaMonteOre(t.db, {
          clienteRefId: crypto.randomUUID(),
          ragioneSocialeId: rsId,
          dati: { nome: "x", minutiIncluse: 60, dataInizio: "2026-01-01" },
        }),
      ).rejects.toThrow("Cliente non trovato");
      await expect(
        creaMonteOre(t.db, {
          clienteRefId: clienteId,
          ragioneSocialeId: crypto.randomUUID(),
          dati: { nome: "x", minutiIncluse: 60, dataInizio: "2026-01-01" },
        }),
      ).rejects.toThrow("Ragione sociale non trovata");
      await expect(contratto({ minutiIncluse: 0 })).rejects.toThrow();
      await expect(contratto({ dataFine: "2025-01-01" })).rejects.toThrow("non può precedere");
    });

    it("modifica parziale; le voci già registrate restano dentro le date", async () => {
      const { id } = await contratto();
      await registraTempo(t.db, { monteOreId: id, data: "2026-02-01", minuti: 30 });
      await modificaMonteOre(t.db, id, { nome: "Assistenza H24", tariffaExtraCent: 6000 });
      const [r] = await riepilogoMonteOre(t.db, "2026-02-02", { id });
      expect(r?.contratto).toMatchObject({
        nome: "Assistenza H24",
        tariffaExtraCent: 6000,
        minutiIncluse: 600,
        dataInizio: "2026-01-15",
      });
      await expect(modificaMonteOre(t.db, id, { dataFine: "2026-01-31" })).rejects.toThrow(
        "fuori dalle nuove date",
      );
      await expect(modificaMonteOre(t.db, id, { dataInizio: "2026-03-01" })).rejects.toThrow(
        "fuori dalle nuove date",
      );
      await expect(modificaMonteOre(t.db, crypto.randomUUID(), {})).rejects.toThrow("non trovato");
    });

    it("cambiando l'arrotondamento le voci si ricalcolano", async () => {
      const { id } = await contratto();
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 20 });
      let [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente?.usati).toBe(30);
      await modificaMonteOre(t.db, id, { arrotondamentoMinuti: 5 });
      [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente?.usati).toBe(20);
      await modificaMonteOre(t.db, id, { arrotondamentoMinuti: 60 });
      [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente?.usati).toBe(60);
    });

    it("con tempo registrato non si elimina, si conclude; concluso non accetta nuove voci", async () => {
      const { id } = await contratto();
      const { id: vuoto } = await contratto({ nome: "Vuoto" });
      await eliminaMonteOre(t.db, vuoto);
      expect((await riepilogoMonteOre(t.db, "2026-01-20")).map((r) => r.contratto.id)).toEqual([
        id,
      ]);
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 30 });
      await expect(eliminaMonteOre(t.db, id)).rejects.toThrow("si conclude");
      await cambiaStatoMonteOre(t.db, id, "concluso");
      await expect(
        registraTempo(t.db, { monteOreId: id, data: "2026-01-21", minuti: 30 }),
      ).rejects.toThrow("concluso");
      await cambiaStatoMonteOre(t.db, id, "attivo");
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-21", minuti: 30 });
    });
  });

  describe("saldo", () => {
    it("ore incluse − usate per periodo dal giorno di inizio; le ore non usate decadono", async () => {
      const { id } = await contratto(); // 10 h dal 15 di ogni mese
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-16", minuti: 100 }); // → 105
      await registraTempo(t.db, { monteOreId: id, data: "2026-02-14", minuti: 15 }); // ancora periodo 0
      await registraTempo(t.db, { monteOreId: id, data: "2026-02-15", minuti: 300 }); // periodo 1
      const [r] = await riepilogoMonteOre(t.db, "2026-02-20", { id });
      expect(r?.cicli.map((c) => [c.inizio, c.usati, c.rimanenti])).toEqual([
        ["2026-01-15", 120, 480],
        ["2026-02-15", 300, 300],
      ]);
      expect(r?.corrente).toMatchObject({ n: 1, usati: 300, rimanenti: 300, extra: 0 });
    });

    it("oltre il monte il saldo va sotto zero ed emergono le ore extra", async () => {
      const { id } = await contratto({ minutiIncluse: 60 });
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 90 });
      const [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente).toMatchObject({ usati: 90, rimanenti: -30, extra: 30, percentuale: 150 });
    });

    it("le voci eliminate e il timer in corso non contano", async () => {
      const { id } = await contratto();
      const v = await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 60 });
      await avviaTimer(t.db, { monteOreId: id, data: "2026-01-20" });
      let [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente?.usati).toBe(60);
      await eliminaTempo(t.db, v.id);
      [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente?.usati).toBe(0);
    });

    it("prima dell'inizio non c'è un periodo", async () => {
      await contratto({ dataInizio: "2026-06-01" });
      const [r] = await riepilogoMonteOre(t.db, "2026-05-01");
      expect(r?.corrente).toBeNull();
    });
  });

  describe("voci di tempo", () => {
    it("con un contratto conta arrotondato per eccesso; senza resta com'è", async () => {
      const { id } = await contratto();
      const con = await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 16 });
      expect(con.minuti).toBe(30);
      const senza = await registraTempo(t.db, {
        clienteRefId: clienteId,
        data: "2026-01-20",
        minuti: 16,
      });
      expect(senza.minuti).toBe(16);
      const voci = await elencaTempo(t.db, { monteOreId: id });
      expect(voci[0]?.v).toMatchObject({ minutiEffettivi: 16, minuti: 30 });
      expect(voci[0]?.contratto).toBe("Assistenza");
    });

    it("controlli: durata, cliente, data nel contratto, ticket e progetto", async () => {
      const { id } = await contratto({ dataFine: "2026-12-31" });
      const base = { monteOreId: id, data: "2026-01-20", minuti: 30 };
      await expect(registraTempo(t.db, { ...base, minuti: 0 })).rejects.toThrow("almeno 1 minuto");
      await expect(registraTempo(t.db, { ...base, minuti: 24 * 60 + 1 })).rejects.toThrow("24 ore");
      await expect(registraTempo(t.db, { ...base, clienteRefId: altroClienteId })).rejects.toThrow(
        "altro cliente",
      );
      await expect(registraTempo(t.db, { ...base, data: "2026-01-14" })).rejects.toThrow(
        "fuori dal periodo",
      );
      await expect(registraTempo(t.db, { ...base, data: "2027-01-01" })).rejects.toThrow(
        "fuori dal periodo",
      );
      await expect(registraTempo(t.db, { data: "2026-01-20", minuti: 30 })).rejects.toThrow(
        "cliente o un contratto",
      );

      const p = await creaProgetto(t.db, { dati: { nome: "Sito" }, clienteRefId: altroClienteId });
      await expect(registraTempo(t.db, { ...base, progettoId: p.id })).rejects.toThrow(
        "progetto è di un altro cliente",
      );
      const tk = await creaTicket(t.db, p.id, { titolo: "Bug" }, null);
      // il ticket porta con sé il progetto, e il cliente del progetto se non c'è altro
      const v = await registraTempo(t.db, {
        data: "2026-01-20",
        minuti: 45,
        ticketId: tk.id,
      });
      const [riga] = await elencaTempo(t.db, { ticketId: tk.id });
      expect(riga?.v).toMatchObject({ progettoId: p.id, clienteRefId: altroClienteId, id: v.id });
      expect(riga?.ticketNumero).toBe(1);
    });

    it("modifica: durata, data, contratto e descrizione, con le stesse regole", async () => {
      const { id } = await contratto();
      const v = await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 30 });
      const m = await modificaTempo(t.db, v.id, { minuti: 50, descrizione: "  Fix  " });
      expect(m.minuti).toBe(60);
      await expect(modificaTempo(t.db, v.id, { data: "2025-12-01" })).rejects.toThrow(
        "fuori dal periodo",
      );
      await modificaTempo(t.db, v.id, { monteOreId: null, clienteRefId: clienteId });
      const [riga] = await elencaTempo(t.db);
      expect(riga?.v).toMatchObject({ monteOreId: null, minuti: 50, descrizione: "Fix" });
      await expect(modificaTempo(t.db, crypto.randomUUID(), {})).rejects.toThrow("non trovata");
      // una voce di un contratto concluso resta modificabile nel resto
      const { id: id2 } = await contratto({ nome: "B" });
      const v2 = await registraTempo(t.db, { monteOreId: id2, data: "2026-01-20", minuti: 30 });
      await cambiaStatoMonteOre(t.db, id2, "concluso");
      expect((await modificaTempo(t.db, v2.id, { descrizione: "nota" })).minuti).toBe(30);
    });

    it("il periodo filtra e le testate sommano", async () => {
      await registraTempo(t.db, { clienteRefId: clienteId, data: "2026-01-10", minuti: 60 });
      await registraTempo(t.db, { clienteRefId: clienteId, data: "2026-01-20", minuti: 30 });
      await registraTempo(t.db, { clienteRefId: altroClienteId, data: "2026-02-01", minuti: 15 });
      expect(await elencaTempo(t.db, { da: "2026-01-15", a: "2026-01-31" })).toHaveLength(1);
      expect(await elencaTempo(t.db, { clienteRefId: clienteId })).toHaveLength(2);
      expect(await minutiNelPeriodo(t.db, "2026-01-01", "2026-01-31")).toBe(90);
      expect(await minutiNelPeriodo(t.db, "2026-03-01", "2026-03-31")).toBe(0);
    });
  });

  describe("timer", () => {
    it("uno alla volta; si ferma con i minuti trascorsi, arrotondati dal contratto", async () => {
      const { id } = await contratto();
      const inizio = new Date("2026-01-20T10:00:00Z");
      await avviaTimer(t.db, { monteOreId: id, data: "2026-01-20", ora: inizio });
      await expect(
        avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" }),
      ).rejects.toThrow("già un timer");
      expect((await timerAttivo(t.db))?.cliente).toBe("Trattoria");
      expect(await elencaTempo(t.db)).toHaveLength(0);

      const r = await fermaTimer(t.db, new Date("2026-01-20T10:41:00Z"));
      expect(r.minuti).toBe(45); // 41 min → 45
      expect(await timerAttivo(t.db)).toBeNull();
      const [riga] = await elencaTempo(t.db);
      expect(riga?.v).toMatchObject({ minutiEffettivi: 41, minuti: 45, avviatoAt: null });
      await expect(fermaTimer(t.db)).rejects.toThrow("Nessun timer");
    });

    it("anche pochi secondi valgono almeno un minuto; lo scarto non registra nulla", async () => {
      await avviaTimer(t.db, {
        clienteRefId: clienteId,
        data: "2026-01-20",
        ora: new Date("2026-01-20T10:00:00Z"),
      });
      expect((await fermaTimer(t.db, new Date("2026-01-20T10:00:10Z"))).minuti).toBe(1);
      await avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" });
      await scartaTimer(t.db);
      expect(await timerAttivo(t.db)).toBeNull();
      expect(await elencaTempo(t.db)).toHaveLength(1);
      await expect(scartaTimer(t.db)).rejects.toThrow("Nessun timer");
      // dopo lo scarto se ne può avviare un altro
      await avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" });
    });

    it("due avvii in parallelo: ne parte uno solo", async () => {
      const esiti = await Promise.allSettled([
        avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" }),
        avviaTimer(t.db, { clienteRefId: altroClienteId, data: "2026-01-20" }),
      ]);
      expect(esiti.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    });

    it("un timer in corso non si modifica", async () => {
      const { id } = await avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" });
      await expect(modificaTempo(t.db, id, { minuti: 30 })).rejects.toThrow("ancora in corso");
    });
  });

  describe("ore extra, estratto e avvio rapido", () => {
    const bozza = async () => {
      const [f] = await t.db
        .insert(fatture)
        .values({
          ragioneSocialeId: rsId,
          clienteRefId: clienteId,
          anno: 2026,
          snapshot: { emittente: {}, cliente: {}, regole: {} },
        })
        .returning();
      return f?.id ?? "";
    };

    it("le ore extra già fatturate non tornano da fatturare; eliminando la bozza sì", async () => {
      const { id } = await contratto({ minutiIncluse: 60 });
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-20", minuti: 150 }); // 150 → extra 90
      let [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente).toMatchObject({ extra: 90, extraFatturati: 0, daFatturare: 90 });
      const f = await bozza();
      await registraOreExtraFatturate(t.db, {
        monteOreId: id,
        cicloN: 0,
        minuti: 90,
        fatturaId: f,
      });
      [r] = await riepilogoMonteOre(t.db, "2026-01-20", { id });
      expect(r?.corrente).toMatchObject({ extra: 90, extraFatturati: 90, daFatturare: 0 });
      // altro tempo nello stesso periodo: solo il nuovo extra è da fatturare
      await registraTempo(t.db, { monteOreId: id, data: "2026-01-21", minuti: 30 });
      [r] = await riepilogoMonteOre(t.db, "2026-01-21", { id });
      expect(r?.corrente).toMatchObject({ extra: 120, daFatturare: 30 });
      // fattura eliminata: le ore tornano da fatturare
      await t.db.update(fatture).set({ deletedAt: new Date() });
      [r] = await riepilogoMonteOre(t.db, "2026-01-21", { id });
      expect(r?.corrente).toMatchObject({ extraFatturati: 0, daFatturare: 120 });
    });

    it("la descrizione del timer si scrive dopo l'avvio", async () => {
      await expect(aggiornaTimer(t.db, { descrizione: "x" })).rejects.toThrow("Nessun timer");
      await avviaTimer(t.db, { clienteRefId: clienteId, data: "2026-01-20" });
      await aggiornaTimer(t.db, { descrizione: "  Revisione  " });
      expect((await timerAttivo(t.db))?.v.descrizione).toBe("Revisione");
      await aggiornaTimer(t.db, { descrizione: "" });
      expect((await timerAttivo(t.db))?.v.descrizione).toBeNull();
    });

    it("il recente propone le combinazioni più nuove, senza doppioni e senza contratti conclusi", async () => {
      const { id } = await contratto();
      const { id: chiuso } = await contratto({ nome: "Vecchio" });
      await registraTempo(t.db, { monteOreId: chiuso, data: "2026-01-20", minuti: 30 });
      await cambiaStatoMonteOre(t.db, chiuso, "concluso");
      await registraTempo(t.db, {
        clienteRefId: altroClienteId,
        data: "2026-01-20",
        minuti: 10,
        descrizione: "Sito",
      });
      await registraTempo(t.db, {
        monteOreId: id,
        data: "2026-01-20",
        minuti: 30,
        descrizione: "Fix",
      });
      await registraTempo(t.db, {
        monteOreId: id,
        data: "2026-01-21",
        minuti: 30,
        descrizione: "Fix",
      });
      const r = await tempoRecente(t.db);
      expect(r.map((x) => [x.cliente, x.contratto, x.descrizione])).toEqual([
        ["Trattoria", "Assistenza", "Fix"],
        ["Studio", null, "Sito"],
      ]);
    });

    it("l'estratto ore ha emittente, cliente, periodo e voci", async () => {
      const { id } = await contratto();
      await registraTempo(t.db, {
        monteOreId: id,
        data: "2026-01-16",
        minuti: 40,
        descrizione: "Setup",
      });
      await registraTempo(t.db, { monteOreId: id, data: "2026-02-16", minuti: 20 });
      const corrente = await datiPdfOre(t.db, id, "2026-02-20");
      expect(corrente?.dati).toMatchObject({
        contratto: "Assistenza",
        inizio: "2026-02-15",
        fine: "2026-03-14",
        usatiMinuti: 30,
        emittente: { nome: "MC Digital" },
        cliente: { nome: "Trattoria" },
      });
      expect(corrente?.dati.voci).toHaveLength(1);
      expect(corrente?.nomeFile).toBe("Estratto-ore-Assistenza-2026-02-15.pdf");
      const primo = await datiPdfOre(t.db, id, "2026-02-20", 0);
      expect(primo?.dati.voci).toMatchObject([
        { descrizione: "Setup", effettiviMinuti: 40, minuti: 45 },
      ]);
      expect(await datiPdfOre(t.db, id, "2026-02-20", 9)).toBeNull();
      expect(await datiPdfOre(t.db, crypto.randomUUID(), "2026-02-20")).toBeNull();
    });
  });
});
