import { randomUUID } from "node:crypto";
import {
  CATEGORIE_DOCUMENTO,
  CATEGORIE_PROGETTO,
  chiaveOggetto,
  codiceTicket,
  commentoTicketSchema,
  LIMITE_FILE_BYTE,
  nomeFileSicuro,
  PRIORITA_PROGETTO,
  progettoDatiSchema,
  risorsaSchema,
  STATI_PROGETTO,
  STATI_TICKET,
  TIPI_TICKET,
} from "@telaio/core";
import {
  aggiungiRisorsa,
  and,
  asc,
  cambiaStatoProgetto,
  clientiRef,
  commentaTicket,
  creaProgetto,
  creaProgettoDaPreventivo,
  creaTicket,
  desc,
  documentiDelProgetto,
  documentoPerId,
  eliminaCommento,
  eliminaDocumento,
  eliminaRisorsa,
  eliminaTicket,
  eq,
  ilike,
  isNull,
  modificaDocumento,
  modificaProgetto,
  modificaRisorsa,
  modificaTicket,
  or,
  progetti,
  progettoRisorse,
  registraDocumento,
  spostaTicket,
  sql,
  ticket,
  ticketCommenti,
  ticketDelProgetto,
} from "@telaio/db";
import { z } from "zod";
import { archivioPronto, caricaOggetto, eliminaOggetto, leggiOggetto } from "../archivio/s3";
import { risolviClienteRef } from "../dominio/cliente-ref";
import { leggiTicketImpostazioni, salvaTicketImpostazioni } from "../ticket-impostazioni";
import { type Strumento, strumento } from "./base";
import { data, id, limite } from "./schemi";

/** Quanto può pesare un file che passa da una chiamata MCP (base64 dentro il JSON). */
const LIMITE_MCP_BYTE = 10 * 1024 * 1024;

const testoOpt = z.string().nullish();

// Una modifica non deve riscrivere ciò che non è stato indicato: i campi non hanno valori di default.
const progettoCampi = {
  nome: z.string().min(1).max(200),
  descrizione: testoOpt,
  categoria: z.enum(CATEGORIE_PROGETTO),
  stato: z.enum(STATI_PROGETTO),
  priorita: z.enum(PRIORITA_PROGETTO),
  responsabileId: testoOpt,
  dataInizioPrevista: data.nullish(),
  dataFinePrevista: data.nullish(),
};
const clienteProgetto = {
  clienteTwentyId: z
    .string()
    .nullish()
    .describe("id Company di Twenty (da cerca_clienti); null toglie il cliente"),
  preventivoId: z
    .uuid()
    .nullish()
    .describe(
      "solo un preventivo accettato con almeno una prestazione accettata; null lo scollega",
    ),
};

const ticketCampi = {
  titolo: z.string().min(1).max(200),
  descrizione: testoOpt,
  tipo: z.enum(TIPI_TICKET),
  stato: z.enum(STATI_TICKET),
  priorita: z.enum(PRIORITA_PROGETTO),
  assegnatarioId: testoOpt,
  scadenza: data.nullish(),
};

const risorsaCampi = risorsaSchema.shape;

/** Progetti, risorse, ticket, commenti, documenti e impostazioni dei ticket. */
export const PROGETTI: Record<string, Strumento> = {
  // ── Progetti ─────────────────────────────────────────────────────────────────
  elenca_progetti: strumento(
    {
      stato: z.enum(STATI_PROGETTO).optional(),
      testo: z.string().optional().describe("nome o codice"),
      clienteTwentyId: z.string().optional(),
      limite,
    },
    async (db, { stato, testo, clienteTwentyId, limite: n }) => {
      const righe = await db
        .select({ p: progetti, cliente: clientiRef.nome })
        .from(progetti)
        .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
        .where(
          and(
            isNull(progetti.deletedAt),
            stato ? eq(progetti.stato, stato) : undefined,
            testo
              ? or(ilike(progetti.nome, `%${testo}%`), ilike(progetti.codice, `%${testo}%`))
              : undefined,
            clienteTwentyId ? eq(clientiRef.twentyCompanyId, clienteTwentyId) : undefined,
          ),
        )
        .orderBy(desc(progetti.updatedAt))
        .limit(n ?? 100);
      return righe.map(({ p, cliente }) => ({
        id: p.id,
        codice: p.codice,
        nome: p.nome,
        cliente,
        categoria: p.categoria,
        stato: p.stato,
        priorita: p.priorita,
        preventivoId: p.preventivoId,
        dataInizioPrevista: p.dataInizioPrevista,
        dataFinePrevista: p.dataFinePrevista,
      }));
    },
  ),

  dettaglio_progetto: strumento({ id }, async (db, { id: progettoId }) => {
    const [r] = await db
      .select({
        p: progetti,
        cliente: clientiRef.nome,
        clienteTwentyId: clientiRef.twentyCompanyId,
      })
      .from(progetti)
      .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
      .where(and(eq(progetti.id, progettoId), isNull(progetti.deletedAt)));
    if (!r) throw new Error("Progetto non trovato");
    const [risorse, perStato, documenti] = await Promise.all([
      db
        .select()
        .from(progettoRisorse)
        .where(eq(progettoRisorse.progettoId, progettoId))
        .orderBy(asc(progettoRisorse.ordine)),
      db
        .select({ stato: ticket.stato, n: sql<number>`count(*)::int` })
        .from(ticket)
        .where(and(eq(ticket.progettoId, progettoId), isNull(ticket.deletedAt)))
        .groupBy(ticket.stato),
      documentiDelProgetto(db, progettoId),
    ]);
    return {
      progetto: r.p,
      cliente: r.cliente,
      clienteTwentyId: r.clienteTwentyId,
      risorse,
      ticketPerStato: Object.fromEntries(perStato.map((x) => [x.stato, x.n])),
      documenti: documenti.map(({ d }) => ({
        id: d.id,
        nome: d.nome,
        categoria: d.categoria,
        dimensioneByte: d.dimensioneByte,
        ticketId: d.ticketId,
      })),
    };
  }),

  crea_progetto: strumento(
    {
      nome: progettoCampi.nome,
      descrizione: progettoCampi.descrizione,
      categoria: progettoCampi.categoria.optional(),
      stato: progettoCampi.stato.optional(),
      priorita: progettoCampi.priorita.optional(),
      responsabileId: progettoCampi.responsabileId,
      dataInizioPrevista: progettoCampi.dataInizioPrevista,
      dataFinePrevista: progettoCampi.dataFinePrevista,
      ...clienteProgetto,
    },
    async (db, { clienteTwentyId, preventivoId, ...dati }) => {
      const cliente = clienteTwentyId ? await risolviClienteRef(db, clienteTwentyId) : null;
      return creaProgetto(db, {
        dati,
        clienteRefId: cliente?.id ?? null,
        preventivoId: preventivoId ?? null,
      });
    },
  ),

  crea_progetto_da_preventivo: strumento(
    {
      preventivoId: id,
      nome: z.string().optional().describe("predefinito: l'oggetto del preventivo"),
      categoria: progettoCampi.categoria.optional(),
    },
    (db, { preventivoId, nome, categoria }) =>
      creaProgettoDaPreventivo(db, { preventivoId, dati: { nome, categoria } }),
  ),

  modifica_progetto: strumento(
    {
      id,
      nome: progettoCampi.nome.optional(),
      descrizione: progettoCampi.descrizione,
      categoria: progettoCampi.categoria.optional(),
      stato: progettoCampi.stato.optional(),
      priorita: progettoCampi.priorita.optional(),
      responsabileId: progettoCampi.responsabileId,
      dataInizioPrevista: progettoCampi.dataInizioPrevista,
      dataFinePrevista: progettoCampi.dataFinePrevista,
      ...clienteProgetto,
    },
    async (db, { id: progettoId, clienteTwentyId, preventivoId, ...patch }) => {
      const [att] = await db
        .select()
        .from(progetti)
        .where(and(eq(progetti.id, progettoId), isNull(progetti.deletedAt)));
      if (!att) throw new Error("Progetto non trovato");
      const definiti = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const dati = progettoDatiSchema.parse({
        nome: att.nome,
        descrizione: att.descrizione,
        categoria: att.categoria,
        stato: att.stato,
        priorita: att.priorita,
        responsabileId: att.responsabileId,
        dataInizioPrevista: att.dataInizioPrevista,
        dataFinePrevista: att.dataFinePrevista,
        ...definiti,
      });
      const cliente = clienteTwentyId ? await risolviClienteRef(db, clienteTwentyId) : null;
      const esito = await modificaProgetto(db, progettoId, {
        dati,
        clienteRefId: clienteTwentyId === undefined ? undefined : (cliente?.id ?? null),
        preventivoId,
      });
      return { id: progettoId, ...esito };
    },
  ),

  cambia_stato_progetto: strumento(
    {
      id,
      stato: z
        .enum(STATI_PROGETTO)
        .describe("«annullato» al posto dell'eliminazione: un progetto non si cancella"),
    },
    async (db, { id: progettoId, stato }) => ({
      id: progettoId,
      cambio: await cambiaStatoProgetto(db, progettoId, stato),
    }),
  ),

  // ── Risorse (collegamenti esterni) ────────────────────────────────────────────
  aggiungi_risorsa_progetto: strumento(
    { progettoId: id, ...risorsaCampi },
    (db, { progettoId, ...dati }) => aggiungiRisorsa(db, progettoId, dati),
  ),
  modifica_risorsa_progetto: strumento(
    { id, ...risorsaSchema.partial().shape },
    async (db, { id: risorsaId, ...patch }) => {
      const [att] = await db
        .select()
        .from(progettoRisorse)
        .where(eq(progettoRisorse.id, risorsaId));
      if (!att) throw new Error("Risorsa non trovata");
      const definiti = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      return modificaRisorsa(db, risorsaId, {
        tipo: att.tipo,
        titolo: att.titolo,
        url: att.url,
        descrizione: att.descrizione,
        ambiente: att.ambiente,
        principale: att.principale,
        ...definiti,
      });
    },
  ),
  elimina_risorsa_progetto: strumento({ id }, (db, { id: risorsaId }) =>
    eliminaRisorsa(db, risorsaId),
  ),

  // ── Ticket ───────────────────────────────────────────────────────────────────
  elenca_ticket: strumento(
    {
      progettoId: id.optional(),
      stato: z.enum(STATI_TICKET).optional(),
      tipo: z.enum(TIPI_TICKET).optional(),
      priorita: z.enum(PRIORITA_PROGETTO).optional(),
      testo: z.string().optional(),
      limite,
    },
    async (db, { progettoId, stato, tipo, priorita, testo, limite: n }) => {
      const tutti = await ticketDelProgetto(db, progettoId);
      const q = testo?.toLowerCase();
      return tutti
        .filter(
          ({ t }) =>
            (!stato || t.stato === stato) &&
            (!tipo || t.tipo === tipo) &&
            (!priorita || t.priorita === priorita) &&
            (!q || `${t.titolo} ${t.descrizione ?? ""}`.toLowerCase().includes(q)),
        )
        .slice(0, n ?? 100)
        .map(({ t, codiceProgetto, nomeProgetto, assegnatario, commenti, documenti }) => ({
          id: t.id,
          codice: codiceTicket(codiceProgetto, t.numero),
          progettoId: t.progettoId,
          progetto: nomeProgetto,
          titolo: t.titolo,
          tipo: t.tipo,
          stato: t.stato,
          priorita: t.priorita,
          assegnatario,
          scadenza: t.scadenza,
          commenti,
          documenti,
        }));
    },
  ),

  dettaglio_ticket: strumento({ id }, async (db, { id: ticketId }) => {
    const [r] = await db
      .select({ t: ticket, codice: progetti.codice })
      .from(ticket)
      .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
      .where(and(eq(ticket.id, ticketId), isNull(ticket.deletedAt)));
    if (!r) throw new Error("Ticket non trovato");
    const [commenti, documenti] = await Promise.all([
      db
        .select()
        .from(ticketCommenti)
        .where(eq(ticketCommenti.ticketId, ticketId))
        .orderBy(asc(ticketCommenti.createdAt)),
      documentiDelProgetto(db, r.t.progettoId, { ticketId }),
    ]);
    return {
      ticket: { ...r.t, codice: codiceTicket(r.codice, r.t.numero) },
      commenti,
      documenti: documenti.map(({ d }) => ({
        id: d.id,
        nome: d.nome,
        categoria: d.categoria,
        dimensioneByte: d.dimensioneByte,
      })),
    };
  }),

  crea_ticket: strumento(
    {
      progettoId: id,
      titolo: ticketCampi.titolo,
      descrizione: ticketCampi.descrizione,
      tipo: ticketCampi.tipo.optional(),
      stato: ticketCampi.stato.optional(),
      priorita: ticketCampi.priorita.optional(),
      assegnatarioId: ticketCampi.assegnatarioId,
      scadenza: ticketCampi.scadenza,
    },
    async (db, { progettoId, ...dati }) => {
      // Con l'assegnazione automatica un ticket senza assegnatario resta senza: non c'è un utente che lo crea.
      return creaTicket(db, progettoId, dati, null);
    },
  ),

  modifica_ticket: strumento(
    {
      id,
      titolo: ticketCampi.titolo.optional(),
      descrizione: ticketCampi.descrizione,
      tipo: ticketCampi.tipo.optional(),
      stato: ticketCampi.stato.optional(),
      priorita: ticketCampi.priorita.optional(),
      assegnatarioId: ticketCampi.assegnatarioId,
      scadenza: ticketCampi.scadenza,
    },
    async (db, { id: ticketId, ...patch }) => {
      const [att] = await db
        .select()
        .from(ticket)
        .where(and(eq(ticket.id, ticketId), isNull(ticket.deletedAt)));
      if (!att) throw new Error("Ticket non trovato");
      const definiti = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      return modificaTicket(db, ticketId, {
        titolo: att.titolo,
        descrizione: att.descrizione,
        tipo: att.tipo,
        stato: att.stato,
        priorita: att.priorita,
        assegnatarioId: att.assegnatarioId,
        scadenza: att.scadenza,
        ...definiti,
      });
    },
  ),

  sposta_ticket: strumento(
    {
      id,
      stato: z.enum(STATI_TICKET),
      primaDiTicketId: id
        .nullish()
        .describe("mette il ticket sopra questo (della stessa colonna); vuoto = in fondo"),
    },
    (db, { id: ticketId, stato, primaDiTicketId }) =>
      spostaTicket(db, ticketId, { stato, primaDi: primaDiTicketId ?? null }),
  ),

  elimina_ticket: strumento({ id }, async (db, { id: ticketId }) => ({
    ...(await eliminaTicket(db, ticketId)),
    eliminato: true,
  })),

  commenta_ticket: strumento(
    { ticketId: id, ...commentoTicketSchema.shape },
    (db, { ticketId, testo }) => commentaTicket(db, ticketId, null, { testo }),
  ),
  elimina_commento_ticket: strumento({ id }, async (db, { id: commentoId }) => {
    await eliminaCommento(db, commentoId);
    return { id: commentoId, eliminato: true };
  }),

  // ── Documenti ────────────────────────────────────────────────────────────────
  elenca_documenti_progetto: strumento(
    { progettoId: id, ticketId: id.optional() },
    async (db, { progettoId, ticketId }) =>
      (await documentiDelProgetto(db, progettoId, { ticketId })).map(({ d, caricatoDa }) => ({
        id: d.id,
        nome: d.nome,
        categoria: d.categoria,
        descrizione: d.descrizione,
        tipoMime: d.tipoMime,
        dimensioneByte: d.dimensioneByte,
        ticketId: d.ticketId,
        caricatoDa,
        creatoIl: d.createdAt,
      })),
  ),

  carica_documento: strumento(
    {
      progettoId: id,
      ticketId: id.optional(),
      nome: z.string().min(1).max(300),
      contenutoBase64: z.string().min(1).describe("contenuto del file in base64, fino a 10 MB"),
      tipoMime: z.string().optional(),
      categoria: z.enum(CATEGORIE_DOCUMENTO).optional(),
      descrizione: z.string().max(500).optional(),
    },
    async (db, i) => {
      const corpo = Buffer.from(i.contenutoBase64, "base64");
      if (corpo.length === 0) throw new Error("Il file è vuoto o il base64 non è valido");
      if (corpo.length > Math.min(LIMITE_MCP_BYTE, LIMITE_FILE_BYTE))
        throw new Error("Il file supera il limite di 10 MB per il caricamento da MCP");
      const archivio = await archivioPronto(db);
      const nome = nomeFileSicuro(i.nome);
      const documentoId = randomUUID();
      const chiave = chiaveOggetto({
        prefisso: archivio.config.prefisso,
        progettoId: i.progettoId,
        documentoId,
        nome,
      });
      const tipoMime = i.tipoMime || "application/octet-stream";
      await caricaOggetto(archivio, chiave, corpo, tipoMime);
      try {
        await registraDocumento(db, {
          id: documentoId,
          progettoId: i.progettoId,
          ticketId: i.ticketId ?? null,
          nome,
          chiave,
          dimensioneByte: corpo.length,
          tipoMime,
          categoria: i.categoria,
          descrizione: i.descrizione,
          caricatoDaId: null,
        });
      } catch (e) {
        // il file è nel bucket ma non nel database: si toglie, per non lasciare file senza padrone
        await eliminaOggetto(archivio, chiave).catch(() => {});
        throw e;
      }
      return { id: documentoId, nome, dimensioneByte: corpo.length };
    },
  ),

  scarica_documento: strumento({ id }, async (db, { id: documentoId }) => {
    const d = await documentoPerId(db, documentoId);
    if (!d) throw new Error("Documento non trovato");
    if (d.dimensioneByte > LIMITE_MCP_BYTE)
      throw new Error("Il file supera i 10 MB: scaricalo dall'app");
    const { corpo } = await leggiOggetto(await archivioPronto(db), d.chiave);
    const contenuto = Buffer.from(await new Response(corpo).arrayBuffer());
    return {
      id: d.id,
      nome: d.nome,
      tipoMime: d.tipoMime,
      dimensioneByte: contenuto.length,
      contenutoBase64: contenuto.toString("base64"),
    };
  }),

  modifica_documento: strumento(
    {
      id,
      categoria: z.enum(CATEGORIE_DOCUMENTO).optional(),
      descrizione: z.string().max(500).nullish(),
      ticketId: id.nullish().describe("ticket dello stesso progetto; null lo stacca"),
    },
    async (db, { id: documentoId, ...dati }) => ({
      id: documentoId,
      ...(await modificaDocumento(db, documentoId, dati)),
    }),
  ),

  elimina_documento: strumento({ id }, async (db, { id: documentoId }) => {
    const d = await eliminaDocumento(db, documentoId);
    // già tolto dal progetto: se il bucket non risponde il file resta lì, ma l'app non lo raggiunge più
    await eliminaOggetto(await archivioPronto(db), d.chiave).catch(() => {});
    return { id: documentoId, nome: d.nome, eliminato: true };
  }),

  // ── Impostazioni dei ticket ──────────────────────────────────────────────────
  leggi_impostazioni_ticket: strumento({}, (db) => leggiTicketImpostazioni(db)),
  imposta_impostazioni_ticket: strumento(
    { autoAssegna: z.boolean() },
    async (db, { autoAssegna }) => {
      await salvaTicketImpostazioni(db, { autoAssegna });
      return { autoAssegna };
    },
  ),
};
