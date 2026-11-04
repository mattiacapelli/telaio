import { CATEGORIE_DOCUMENTO, STATI_TICKET, TIPI_TICKET } from "@telaio/core";
import {
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
import { users } from "./auth";
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
 * File di un progetto (e, volendo, di un suo ticket). Il contenuto sta nel bucket S3 configurato
 * in Impostazioni → Archiviazione; qui restano nome, dimensione e la chiave dell'oggetto.
 */
export const progettoDocumenti = pgTable(
  "progetto_documenti",
  {
    id: id(),
    progettoId: uuid("progetto_id")
      .notNull()
      .references(() => progetti.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id").references(() => ticket.id, { onDelete: "set null" }),
    /** nome originale del file, come lo vede l'utente */
    nome: text("nome").notNull(),
    chiave: text("chiave").notNull().unique(),
    dimensioneByte: integer("dimensione_byte").notNull(),
    tipoMime: text("tipo_mime").notNull().default("application/octet-stream"),
    categoria: categoriaDocumentoEnum("categoria").notNull().default("altro"),
    descrizione: text("descrizione"),
    caricatoDaId: text("caricato_da_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("progetto_documenti_progetto_idx").on(t.progettoId, t.createdAt),
    index("progetto_documenti_ticket_idx").on(t.ticketId),
  ],
);
