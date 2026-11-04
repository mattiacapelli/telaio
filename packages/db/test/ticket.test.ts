import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  documentiDelProgetto,
  eliminaDocumento,
  registraDocumento,
} from "../src/documenti-progetto";
import { creaProgetto } from "../src/progetti";
import { progettoDocumenti, ticket, users } from "../src/schema";
import {
  commentaTicket,
  creaTicket,
  eliminaCommento,
  eliminaTicket,
  modificaTicket,
  spostaTicket,
  ticketDelProgetto,
} from "../src/ticket";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

describe.skipIf(!URL_SERVER)("ticket e documenti (Postgres reale)", () => {
  let t: DbTemporaneo;
  let progettoId: string;
  let altroProgettoId: string;

  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
    await t.db.insert(users).values({ id: "u1", name: "Mattia", email: "m@telaio.local" });
    progettoId = (await creaProgetto(t.db, { dati: { nome: "Sito" } })).id;
    altroProgettoId = (await creaProgetto(t.db, { dati: { nome: "App" } })).id;
  });
  afterAll(async () => {
    await t?.elimina();
  });

  const nuovo = (titolo: string, stato = "da_fare", p = progettoId) =>
    creaTicket(t.db, p, { titolo, stato }, "u1");
  const colonna = async (stato: string) =>
    (await ticketDelProgetto(t.db, progettoId))
      .filter((r) => r.t.stato === stato)
      .map((r) => r.t.titolo);

  describe("creazione", () => {
    it("numero progressivo per progetto e codice leggibile", async () => {
      const a = await nuovo("Primo");
      const b = await nuovo("Secondo");
      const c = await nuovo("Altro progetto", "da_fare", altroProgettoId);
      expect([a.numero, b.numero, c.numero]).toEqual([1, 2, 1]);
      expect(a.codice).toMatch(/^PRJ-\d{4}-\d{3}-1$/);
      const [r] = await t.db.select().from(ticket).where(eq(ticket.id, a.id));
      expect(r).toMatchObject({ segnalatoreId: "u1", stato: "da_fare", tipo: "attivita" });
    });

    it("richieste in parallelo: numeri distinti e senza buchi", async () => {
      const r = await Promise.all(Array.from({ length: 8 }, (_, i) => nuovo(`T${i}`)));
      expect(r.map((x) => x.numero).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("ogni nuovo ticket va in fondo alla sua colonna", async () => {
      await nuovo("a");
      await nuovo("b");
      await nuovo("c", "in_corso");
      expect(await colonna("da_fare")).toEqual(["a", "b"]);
      expect(await colonna("in_corso")).toEqual(["c"]);
    });

    it("rifiuta progetto inesistente, assegnatario inesistente e titolo vuoto", async () => {
      await expect(nuovo("x", "da_fare", "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        "Progetto non trovato",
      );
      await expect(
        creaTicket(t.db, progettoId, { titolo: "x", assegnatarioId: "nessuno" }, null),
      ).rejects.toThrow("assegnatario");
      await expect(nuovo("  ")).rejects.toThrow();
    });

    it("creato direttamente come completato: registra la chiusura", async () => {
      const { id } = await nuovo("fatto", "completato");
      const [r] = await t.db.select().from(ticket).where(eq(ticket.id, id));
      expect(r?.completatoAt).not.toBeNull();
    });
  });

  describe("modifica", () => {
    it("cambia i dati e, cambiando stato, va in fondo alla nuova colonna", async () => {
      const a = await nuovo("a");
      await nuovo("x", "in_corso");
      const esito = await modificaTicket(t.db, a.id, {
        titolo: "a2",
        stato: "in_corso",
        priorita: "alta",
        assegnatarioId: "u1",
      });
      expect(esito.cambioStato).toEqual({ da: "da_fare", a: "in_corso" });
      expect(await colonna("in_corso")).toEqual(["x", "a2"]);
      const [r] = await t.db.select().from(ticket).where(eq(ticket.id, a.id));
      expect(r).toMatchObject({ priorita: "alta", assegnatarioId: "u1" });
    });

    it("senza cambio di stato resta dov'è", async () => {
      const a = await nuovo("a");
      await nuovo("b");
      const esito = await modificaTicket(t.db, a.id, { titolo: "a2", stato: "da_fare" });
      expect(esito.cambioStato).toBeNull();
      expect(await colonna("da_fare")).toEqual(["a2", "b"]);
    });

    it("completato fissa la chiusura, riaprire la toglie", async () => {
      const a = await nuovo("a");
      await modificaTicket(t.db, a.id, { titolo: "a", stato: "completato" });
      const [chiuso] = await t.db.select().from(ticket).where(eq(ticket.id, a.id));
      expect(chiuso?.completatoAt).not.toBeNull();
      await modificaTicket(t.db, a.id, { titolo: "a2", stato: "completato" });
      const [stesso] = await t.db.select().from(ticket).where(eq(ticket.id, a.id));
      expect(stesso?.completatoAt?.getTime()).toBe(chiuso?.completatoAt?.getTime());
      await modificaTicket(t.db, a.id, { titolo: "a", stato: "in_corso" });
      const [riaperto] = await t.db.select().from(ticket).where(eq(ticket.id, a.id));
      expect(riaperto?.completatoAt).toBeNull();
    });
  });

  describe("lavagna: spostamenti", () => {
    it("in un'altra colonna, in cima, in mezzo e in fondo", async () => {
      const a = await nuovo("a");
      const b = await nuovo("b");
      const c = await nuovo("c");
      const x = await nuovo("x", "in_corso");
      const y = await nuovo("y", "in_corso");

      // in fondo (primaDi null)
      let esito = await spostaTicket(t.db, a.id, { stato: "in_corso", primaDi: null });
      expect(esito.cambioStato).toEqual({ da: "da_fare", a: "in_corso" });
      expect(await colonna("in_corso")).toEqual(["x", "y", "a"]);
      // in cima
      await spostaTicket(t.db, b.id, { stato: "in_corso", primaDi: x.id });
      expect(await colonna("in_corso")).toEqual(["b", "x", "y", "a"]);
      // in mezzo
      await spostaTicket(t.db, c.id, { stato: "in_corso", primaDi: y.id });
      expect(await colonna("in_corso")).toEqual(["b", "x", "c", "y", "a"]);
      expect(await colonna("da_fare")).toEqual([]);
      esito = await spostaTicket(t.db, c.id, { stato: "in_corso", primaDi: b.id });
      expect(esito.cambioStato).toBeNull();
      expect(await colonna("in_corso")).toEqual(["c", "b", "x", "y", "a"]);
    });

    it("riordina dentro la stessa colonna, anche ripetutamente (spazio che si esaurisce)", async () => {
      const a = await nuovo("a");
      const b = await nuovo("b");
      // inserisce sempre tra a e b: dopo molti dimezzamenti le posizioni si toccano e la colonna si riordina
      const extra: string[] = [];
      for (let i = 0; i < 60; i++) extra.push((await nuovo(`e${i}`)).id);
      for (const id of extra) await spostaTicket(t.db, id, { stato: "da_fare", primaDi: b.id });
      const ordine = await colonna("da_fare");
      expect(ordine).toHaveLength(62);
      expect(ordine[0]).toBe("a");
      expect(ordine.at(-1)).toBe("b");
      expect(ordine.slice(1, -1)).toEqual(Array.from({ length: 60 }, (_, i) => `e${i}`));
      await spostaTicket(t.db, a.id, { stato: "da_fare", primaDi: null });
      expect((await colonna("da_fare")).at(-1)).toBe("a");
    });

    it("completato fissa la chiusura, uscirne la toglie", async () => {
      const a = await nuovo("a");
      await spostaTicket(t.db, a.id, { stato: "completato", primaDi: null });
      expect(
        (await t.db.select().from(ticket).where(eq(ticket.id, a.id)))[0]?.completatoAt,
      ).not.toBeNull();
      await spostaTicket(t.db, a.id, { stato: "da_fare", primaDi: null });
      expect(
        (await t.db.select().from(ticket).where(eq(ticket.id, a.id)))[0]?.completatoAt,
      ).toBeNull();
    });

    it("rifiuta riferimenti sbagliati", async () => {
      const a = await nuovo("a");
      const b = await nuovo("b", "in_corso");
      await expect(spostaTicket(t.db, a.id, { stato: "da_fare", primaDi: a.id })).rejects.toThrow(
        "se stesso",
      );
      // b è in un'altra colonna
      await expect(spostaTicket(t.db, a.id, { stato: "da_fare", primaDi: b.id })).rejects.toThrow(
        "non è in quella colonna",
      );
      await expect(
        spostaTicket(t.db, "00000000-0000-0000-0000-000000000000", {
          stato: "da_fare",
          primaDi: null,
        }),
      ).rejects.toThrow("Ticket non trovato");
    });

    it("spostamenti in parallelo: nessuna posizione duplicata e nessun ticket perso", async () => {
      const ids = await Promise.all(Array.from({ length: 6 }, (_, i) => nuovo(`t${i}`)));
      await Promise.all(
        ids.map((x) => spostaTicket(t.db, x.id, { stato: "in_corso", primaDi: null })),
      );
      const righe = (await ticketDelProgetto(t.db, progettoId)).filter(
        (r) => r.t.stato === "in_corso",
      );
      expect(righe).toHaveLength(6);
    });
  });

  describe("eliminazione e commenti", () => {
    it("il ticket eliminato esce dalla lavagna ma resta nel database", async () => {
      const a = await nuovo("a");
      await nuovo("b");
      const e = await eliminaTicket(t.db, a.id);
      expect(e.progettoId).toBe(progettoId);
      expect(await colonna("da_fare")).toEqual(["b"]);
      expect((await t.db.select().from(ticket)).length).toBe(2);
      await expect(eliminaTicket(t.db, a.id)).rejects.toThrow("Ticket non trovato");
      await expect(modificaTicket(t.db, a.id, { titolo: "x" })).rejects.toThrow(
        "Ticket non trovato",
      );
    });

    it("commenti: aggiunta, conteggio e rimozione", async () => {
      const a = await nuovo("a");
      const c1 = await commentaTicket(t.db, a.id, "u1", { testo: "  Riprodotto  " });
      await commentaTicket(t.db, a.id, "u1", { testo: "Risolto" });
      expect((await ticketDelProgetto(t.db, progettoId))[0]?.commenti).toBe(2);
      await expect(commentaTicket(t.db, a.id, "u1", { testo: "  " })).rejects.toThrow();
      await eliminaCommento(t.db, c1.id);
      expect((await ticketDelProgetto(t.db, progettoId))[0]?.commenti).toBe(1);
      await expect(eliminaCommento(t.db, c1.id)).rejects.toThrow("Commento non trovato");
    });
  });

  describe("documenti", () => {
    const doc = (over: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      progettoId,
      nome: "contratto.pdf",
      chiave: `progetti/${progettoId}/${crypto.randomUUID()}/contratto.pdf`,
      dimensioneByte: 1234,
      tipoMime: "application/pdf",
      categoria: "contratto",
      caricatoDaId: "u1",
      ...over,
    });

    it("registra, elenca (dal più recente) ed elimina", async () => {
      const a = await registraDocumento(t.db, doc());
      const b = await registraDocumento(
        t.db,
        doc({ nome: "specifiche.docx", categoria: "specifiche" }),
      );
      const elenco = await documentiDelProgetto(t.db, progettoId);
      expect(elenco.map((r) => r.d.id)).toEqual([b.id, a.id]);
      expect(elenco[0]?.caricatoDa).toBe("Mattia");

      const tolto = await eliminaDocumento(t.db, a.id);
      expect(tolto.nome).toBe("contratto.pdf");
      expect((await documentiDelProgetto(t.db, progettoId)).map((r) => r.d.id)).toEqual([b.id]);
      expect(await t.db.select().from(progettoDocumenti)).toHaveLength(2);
      await expect(eliminaDocumento(t.db, a.id)).rejects.toThrow("Documento non trovato");
    });

    it("un documento si lega a un ticket dello stesso progetto, non di un altro", async () => {
      const mio = await nuovo("mio");
      const altrui = await nuovo("altrui", "da_fare", altroProgettoId);
      await registraDocumento(t.db, doc({ ticketId: mio.id }));
      await expect(registraDocumento(t.db, doc({ ticketId: altrui.id }))).rejects.toThrow(
        "non appartiene a questo progetto",
      );
      expect(await documentiDelProgetto(t.db, progettoId, { ticketId: mio.id })).toHaveLength(1);
      expect((await ticketDelProgetto(t.db, progettoId))[0]?.documenti).toBe(1);
    });

    it("la chiave dell'oggetto è unica e il progetto deve esistere", async () => {
      const d = doc();
      await registraDocumento(t.db, d);
      await expect(registraDocumento(t.db, doc({ chiave: d.chiave }))).rejects.toThrow();
      await expect(
        registraDocumento(t.db, doc({ progettoId: "00000000-0000-0000-0000-000000000000" })),
      ).rejects.toThrow("Progetto non trovato");
    });
  });
});
