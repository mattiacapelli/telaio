import { CATEGORIE_DOCUMENTO, STATI_TICKET, TIPI_TICKET } from "@telaio/core";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientiRef } from "./anagrafiche";
import { users } from "./auth";
import { preventivi } from "./documenti";
import { deletedAt, id, timestamps } from "./helpers";
import { prioritaProgettoEnum, progetti } from "./progetti";

export const tipoTicketEnum = pgEnum("tipo_ticket", TIPI_TICKET);
export const statoTicketEnum = pgEnum("stato_ticket", STATI_TICKET);
export const categoriaDocumentoEnum = pgEnum("categoria_documento", CATEGORIE_DOCUMENTO);

/**
 * Ticket di un progetto, mostrati sulla lavagna kanban. Lo stato è quello della colonna e non
 * dipende dallo stato del progetto. Il numero è progressivo per progetto.
 */
export const ticket = pgTable(
  "ticket",
  {
    id: id(),
    progettoId: uuid("progetto_id")
      .notNull()
      .references(() => progetti.id),
    numero: integer("numero").notNull(),
    titolo: text("titolo").notNull(),
    descrizione: text("descrizione"),
    tipo: tipoTicketEnum("tipo").notNull().default("attivita"),
    stato: statoTicketEnum("stato").notNull().default("da_fare"),
    priorita: prioritaProgettoEnum("priorita").notNull().default("normale"),
    assegnatarioId: text("assegnatario_id").references(() => users.id, { onDelete: "set null" }),
    segnalatoreId: text("segnalatore_id").references(() => users.id, { onDelete: "set null" }),
    scadenza: date("scadenza"),
    /** ordine nella colonna, dall'alto: numeri reali, così si inserisce tra due ticket senza riscrivere gli altri */
    posizione: doublePrecision("posizione").notNull(),
    /** quando è passato a «completato» l'ultima volta; vuoto se è stato riaperto */
    completatoAt: timestamp("completato_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("ticket_progetto_numero_uq").on(t.progettoId, t.numero),
    index("ticket_lavagna_idx").on(t.progettoId, t.stato, t.posizione),
    index("ticket_assegnatario_idx").on(t.assegnatarioId),
  ],
);

export const ticketCommenti = pgTable(
  "ticket_commenti",
  {
    id: id(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    autoreId: text("autore_id").references(() => users.id, { onDelete: "set null" }),
    testo: text("testo").notNull(),
    ...timestamps,
  },
  (t) => [index("ticket_commenti_ticket_idx").on(t.ticketId, t.createdAt)],
);

/**
 * Allegati: file nel bucket S3 o link, di un progetto (e, volendo, di un suo ticket), di un
 * preventivo o di un cliente. Il nome della tabella è rimasto quello storico.
 *
 * Il contenuto di un file sta nel bucket configurato in Impostazioni → Archiviazione; qui restano
 * nome, dimensione e la chiave dell'oggetto. Più allegati possono puntare alla stessa chiave
 * (un file preso dall'archivio e allegato altrove): l'oggetto si toglie dal bucket solo quando
 * l'ultimo allegato che lo usa viene eliminato.
 */
export const progettoDocumenti = pgTable(
  "progetto_documenti",
  {
    id: id(),
    /** esattamente uno tra progetto, preventivo e cliente */
    progettoId: uuid("progetto_id").references(() => progetti.id, { onDelete: "cascade" }),
    preventivoId: uuid("preventivo_id").references(() => preventivi.id, { onDelete: "cascade" }),
    clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id, { onDelete: "cascade" }),
    /** solo con un progetto: il ticket a cui è allegato */
    ticketId: uuid("ticket_id").references(() => ticket.id, { onDelete: "set null" }),
    tipo: text("tipo", { enum: ["file", "link"] })
      .notNull()
      .default("file"),
    /** nome originale del file (o titolo del link), come lo vede l'utente */
    nome: text("nome").notNull(),
    /** solo file */
    chiave: text("chiave"),
    dimensioneByte: integer("dimensione_byte"),
    tipoMime: text("tipo_mime").notNull().default("application/octet-stream"),
    /** solo link */
    url: text("url"),
    categoria: categoriaDocumentoEnum("categoria").notNull().default("altro"),
    descrizione: text("descrizione"),
    caricatoDaId: text("caricato_da_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("progetto_documenti_progetto_idx").on(t.progettoId, t.createdAt),
    index("progetto_documenti_preventivo_idx").on(t.preventivoId, t.createdAt),
    index("progetto_documenti_cliente_idx").on(t.clienteRefId, t.createdAt),
    index("progetto_documenti_ticket_idx").on(t.ticketId),
    index("progetto_documenti_chiave_idx").on(t.chiave),
    check(
      "progetto_documenti_un_proprietario",
      sql`num_nonnulls(${t.progettoId}, ${t.preventivoId}, ${t.clienteRefId}) = 1`,
    ),
    check(
      "progetto_documenti_ticket_del_progetto",
      sql`${t.ticketId} is null or ${t.progettoId} is not null`,
    ),
    check(
      "progetto_documenti_file_o_link",
      sql`(${t.tipo} = 'file' and ${t.chiave} is not null and ${t.dimensioneByte} is not null and ${t.url} is null)
        or (${t.tipo} = 'link' and ${t.url} is not null and ${t.chiave} is null)`,
    ),
  ],
);
