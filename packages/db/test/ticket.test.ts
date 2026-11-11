import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  allegatiDelCliente,
  allegatiDi,
  collegaDocumentiEsistenti,
  documentiDelProgetto,
  eliminaAllegatiPreventivo,
  eliminaDocumento,
  fileInArchivio,
  modificaDocumento,
  registraDocumento,
  registraLink,
} from "../src/allegati";
import { creaProgetto } from "../src/progetti";
import {
  clientiRef,
  preventivi,
  progettoDocumenti,
  ragioniSociali,
  ticket,
  users,
} from "../src/schema";
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

  describe("elenco di tutti i progetti", () => {
    it("senza progetto: tutti i ticket non eliminati, gli urgenti prima", async () => {
      await creaTicket(t.db, progettoId, { titolo: "normale", priorita: "normale" }, "u1");
      await creaTicket(t.db, altroProgettoId, { titolo: "urgente", priorita: "urgente" }, "u1");
      await creaTicket(t.db, progettoId, { titolo: "bassa", priorita: "bassa" }, "u1");
      const eliminato = await nuovo("eliminato");
      await eliminaTicket(t.db, eliminato.id);
      const tutti = await ticketDelProgetto(t.db);
      expect(tutti.map((r) => r.t.titolo)).toEqual(["urgente", "normale", "bassa"]);
      expect(tutti[0]).toMatchObject({ nomeProgetto: "App" });
      expect(tutti[0]?.codiceProgetto).toMatch(/^PRJ-/);
      // il filtro per progetto resta quello di prima
      expect((await ticketDelProgetto(t.db, altroProgettoId)).map((r) => r.t.titolo)).toEqual([
        "urgente",
      ]);
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
      expect(tolto.chiaveDaRimuovere).toBe(elenco[1]?.d.chiave);
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

    it("modifica categoria, descrizione e ticket; il ticket deve essere dello stesso progetto", async () => {
      const mio = await nuovo("mio");
      const altrui = await nuovo("altrui", "da_fare", altroProgettoId);
      const d = await registraDocumento(t.db, doc());
      await modificaDocumento(t.db, d.id, {
        categoria: "design",
        descrizione: "v2",
        ticketId: mio.id,
      });
      let [r] = await documentiDelProgetto(t.db, progettoId);
      expect(r?.d).toMatchObject({ categoria: "design", descrizione: "v2", ticketId: mio.id });
      await expect(modificaDocumento(t.db, d.id, { ticketId: altrui.id })).rejects.toThrow(
        "non appartiene a questo progetto",
      );
      // senza indicare il ticket resta com'è; con null si stacca
      await modificaDocumento(t.db, d.id, { descrizione: null });
      [r] = await documentiDelProgetto(t.db, progettoId);
      expect(r?.d).toMatchObject({ descrizione: null, ticketId: mio.id });
      await modificaDocumento(t.db, d.id, { ticketId: null });
      [r] = await documentiDelProgetto(t.db, progettoId);
      expect(r?.d.ticketId).toBeNull();
      await expect(
        modificaDocumento(t.db, "00000000-0000-0000-0000-000000000000", {}),
      ).rejects.toThrow("Documento non trovato");
    });

    it("il proprietario deve esistere", async () => {
      await expect(
        registraDocumento(t.db, doc({ progettoId: "00000000-0000-0000-0000-000000000000" })),
      ).rejects.toThrow("Progetto non trovato");
      await expect(
        registraDocumento(t.db, doc({ progettoId: undefined, preventivoId: crypto.randomUUID() })),
      ).rejects.toThrow("Preventivo non trovato");
      await expect(
        registraDocumento(t.db, doc({ progettoId: undefined, clienteRefId: crypto.randomUUID() })),
      ).rejects.toThrow("Cliente non trovato");
    });

    describe("link, preventivi, clienti e file condivisi", () => {
      let clienteId: string;
      let preventivoId: string;

      beforeEach(async () => {
        const [rs] = await t.db.insert(ragioniSociali).values({ nome: "MC Digital" }).returning();
        const [c] = await t.db
          .insert(clientiRef)
          .values({ twentyCompanyId: "tw-1", nome: "Trattoria" })
          .returning();
        clienteId = c?.id ?? "";
        const [p] = await t.db
          .insert(preventivi)
          .values({
            ragioneSocialeId: rs?.id ?? "",
            clienteRefId: clienteId,
            anno: 2026,
            oggetto: "Sito",
            snapshot: { emittente: {}, cliente: {}, regole: {} },
          })
          .returning();
        preventivoId = p?.id ?? "";
      });

      const file = (proprietario: Record<string, string>, over: Record<string, unknown> = {}) => ({
        id: crypto.randomUUID(),
        ...proprietario,
        nome: "brief.pdf",
        chiave: `k/${crypto.randomUUID()}/brief.pdf`,
        dimensioneByte: 10,
        tipoMime: "application/pdf",
        ...over,
      });

      it("un link si allega e si elenca; solo http(s)", async () => {
        const l = await registraLink(t.db, {
          progettoId,
          titolo: " Figma ",
          url: "https://figma.com/f/1",
          categoria: "design",
        });
        const [r] = await documentiDelProgetto(t.db, progettoId);
        expect(r?.d).toMatchObject({
          id: l.id,
          tipo: "link",
          nome: "Figma",
          url: "https://figma.com/f/1",
          chiave: null,
          dimensioneByte: null,
          categoria: "design",
        });
        await expect(
          registraLink(t.db, { progettoId, titolo: "x", url: "javascript:alert(1)" }),
        ).rejects.toThrow();
        const e = await eliminaDocumento(t.db, l.id);
        expect(e).toMatchObject({ tipo: "link", chiaveDaRimuovere: null });
      });

      it("i file stanno sul preventivo e sul cliente, e i ticket solo sui progetti", async () => {
        await registraDocumento(t.db, file({ preventivoId }));
        await registraDocumento(t.db, file({ clienteRefId: clienteId }));
        await registraLink(t.db, { preventivoId, titolo: "Brief", url: "https://x.it" });
        expect(await allegatiDi(t.db, { preventivoId })).toHaveLength(2);
        expect(await allegatiDi(t.db, { clienteRefId: clienteId })).toHaveLength(1);
        expect(await documentiDelProgetto(t.db, progettoId)).toHaveLength(0);
        const tk = await nuovo("t");
        await expect(
          registraDocumento(t.db, file({ preventivoId }, { ticketId: tk.id })),
        ).rejects.toThrow("solo per un progetto");
      });

      it("il database impone un solo proprietario e coerenza tra file e link", async () => {
        await expect(
          t.db.insert(progettoDocumenti).values({ nome: "x", chiave: "k", dimensioneByte: 1 }),
        ).rejects.toThrow();
        await expect(
          t.db.insert(progettoDocumenti).values({
            progettoId,
            preventivoId,
            nome: "x",
            chiave: "k",
            dimensioneByte: 1,
          }),
        ).rejects.toThrow();
        await expect(
          t.db.insert(progettoDocumenti).values({ progettoId, tipo: "link", nome: "x" }),
        ).rejects.toThrow();
      });

      it("un file dell'archivio si allega altrove senza copiarlo: l'oggetto resta finché serve", async () => {
        const a = await registraDocumento(t.db, file({ progettoId }));
        const [orig] = await documentiDelProgetto(t.db, progettoId);
        const creati = await collegaDocumentiEsistenti(t.db, {
          preventivoId,
          documentoIds: [a.id, a.id],
          caricatoDaId: "u1",
        });
        expect(creati).toHaveLength(1);
        const [copia] = await allegatiDi(t.db, { preventivoId });
        expect(copia?.d).toMatchObject({
          chiave: orig?.d.chiave,
          nome: "brief.pdf",
          caricatoDaId: "u1",
        });
        expect(copia?.d.id).not.toBe(a.id);

        // già allegato: no doppioni; ma al ticket dello stesso progetto sì
        await expect(
          collegaDocumentiEsistenti(t.db, { preventivoId, documentoIds: [a.id] }),
        ).rejects.toThrow("già allegato");
        const tk = await nuovo("t");
        await collegaDocumentiEsistenti(t.db, {
          progettoId,
          ticketId: tk.id,
          documentoIds: [a.id],
        });

        // l'oggetto lascia il bucket solo con l'ultimo allegato che lo usa
        expect((await eliminaDocumento(t.db, a.id)).chiaveDaRimuovere).toBeNull();
        expect((await eliminaDocumento(t.db, creati[0]?.id ?? "")).chiaveDaRimuovere).toBeNull();
        const [ultimo] = await documentiDelProgetto(t.db, progettoId);
        expect((await eliminaDocumento(t.db, ultimo?.d.id ?? "")).chiaveDaRimuovere).toBe(
          orig?.d.chiave,
        );
        await expect(
          collegaDocumentiEsistenti(t.db, { preventivoId, documentoIds: [a.id] }),
        ).rejects.toThrow("non è più nell'archivio");
        await expect(
          collegaDocumentiEsistenti(t.db, { preventivoId, documentoIds: [] }),
        ).rejects.toThrow("almeno un file");
      });

      it("l'archivio elenca un file per oggetto, con origine e ricerca", async () => {
        const a = await registraDocumento(t.db, file({ progettoId }, { nome: "Contratto.pdf" }));
        await collegaDocumentiEsistenti(t.db, { preventivoId, documentoIds: [a.id] });
        await registraDocumento(t.db, file({ clienteRefId: clienteId }, { nome: "Logo_100%.png" }));
        await registraLink(t.db, { progettoId, titolo: "Solo link", url: "https://x.it" });
        const tutti = await fileInArchivio(t.db);
        expect(tutti.map((f) => f.nome).sort()).toEqual(["Contratto.pdf", "Logo_100%.png"]);
        expect(tutti.find((f) => f.nome === "Contratto.pdf")?.origine).toMatch(/^Progetto PRJ-/);
        expect(tutti.find((f) => f.nome.startsWith("Logo"))?.origine).toBe("Cliente Trattoria");
        expect((await fileInArchivio(t.db, { testo: "contr" })).map((f) => f.nome)).toEqual([
          "Contratto.pdf",
        ]);
        // % e _ nella ricerca valgono come caratteri, non come jolly
        expect(await fileInArchivio(t.db, { testo: "%" })).toHaveLength(1);
        expect(await fileInArchivio(t.db, { testo: "_" })).toHaveLength(1);
        expect(await fileInArchivio(t.db, { testo: "inesistente" })).toHaveLength(0);
      });

      it("la scheda del cliente raccoglie i suoi file, quelli dei progetti e dei preventivi", async () => {
        const [rs] = await t.db.select().from(ragioniSociali);
        const [altro] = await t.db
          .insert(clientiRef)
          .values({ twentyCompanyId: "tw-2", nome: "Altro" })
          .returning();
        const mio = (await creaProgetto(t.db, { dati: { nome: "Sito" }, clienteRefId: clienteId }))
          .id;
        const [pAltro] = await t.db
          .insert(preventivi)
          .values({
            ragioneSocialeId: rs?.id ?? "",
            clienteRefId: altro?.id,
            anno: 2026,
            oggetto: "Altro",
            snapshot: { emittente: {}, cliente: {}, regole: {} },
          })
          .returning();
        await registraDocumento(t.db, file({ clienteRefId: clienteId }, { nome: "diretto" }));
        await registraDocumento(t.db, file({ progettoId: mio }, { nome: "di-progetto" }));
        await registraDocumento(t.db, file({ preventivoId }, { nome: "di-preventivo" }));
        await registraDocumento(t.db, file({ progettoId }, { nome: "progetto-senza-cliente" }));
        await registraDocumento(
          t.db,
          file({ preventivoId: pAltro?.id ?? "" }, { nome: "di-altri" }),
        );
        const r = await allegatiDelCliente(t.db, clienteId);
        expect(r.map((x) => x.d.nome).sort()).toEqual(["di-preventivo", "di-progetto", "diretto"]);
        expect(r.find((x) => x.d.nome === "di-progetto")?.progetto?.codice).toMatch(/^PRJ-/);
        expect(r.find((x) => x.d.nome === "di-preventivo")?.preventivo?.id).toBe(preventivoId);
        expect(r.find((x) => x.d.nome === "diretto")?.progetto?.id ?? null).toBeNull();
      });

      it("eliminando un preventivo in bozza se ne vanno gli allegati, e i file solo se non servono altrove", async () => {
        const solo = await registraDocumento(t.db, file({ preventivoId }, { nome: "solo" }));
        const cond = await registraDocumento(t.db, file({ preventivoId }, { nome: "cond" }));
        await collegaDocumentiEsistenti(t.db, { progettoId, documentoIds: [cond.id] });
        await registraLink(t.db, { preventivoId, titolo: "L", url: "https://x.it" });
        const [soloRiga] = await t.db
          .select()
          .from(progettoDocumenti)
          .where(eq(progettoDocumenti.id, solo.id));
        const chiavi = await t.db.transaction((tx) => eliminaAllegatiPreventivo(tx, preventivoId));
        expect(chiavi).toEqual([soloRiga?.chiave]);
        expect(await allegatiDi(t.db, { preventivoId })).toHaveLength(0);
        expect(await documentiDelProgetto(t.db, progettoId)).toHaveLength(1);
      });
    });
  });
});
