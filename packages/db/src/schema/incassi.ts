import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientiRef, conti, ragioniSociali } from "./anagrafiche";
import { fatture, preventivi } from "./documenti";
import { deletedAt, id, timestamps } from "./helpers";

export const periodicitaEnum = pgEnum("periodicita", [
  "mensile",
  "trimestrale",
  "semestrale",
  "annuale",
]);
export const statoAbbonamentoEnum = pgEnum("stato_abbonamento", ["attivo", "sospeso", "cessato"]);
export const statoRataEnum = pgEnum("stato_rata", [
  "da_incassare",
  "parziale",
  "incassata",
  "scaduta",
  "annullata",
]);
export const tipoMovimentoEnum = pgEnum("tipo_movimento", ["entrata", "uscita", "giroconto"]);
export const statoSollecitoEnum = pgEnum("stato_sollecito", [
  "programmato",
  "inviato",
  "annullato",
  "da_confermare",
]);

export const abbonamenti = pgTable("abbonamenti", {
  id: id(),
  ragioneSocialeId: uuid("ragione_sociale_id")
    .notNull()
    .references(() => ragioniSociali.id),
  clienteRefId: uuid("cliente_ref_id")
    .notNull()
    .references(() => clientiRef.id),
  preventivoId: uuid("preventivo_id").references(() => preventivi.id),
  descrizione: text("descrizione").notNull(),
  periodicita: periodicitaEnum("periodicita").notNull(),
  importoRataCent: integer("importo_rata_cent").notNull(),
  inizio: date("inizio").notNull(),
  fine: date("fine"),
  stato: statoAbbonamentoEnum("stato").notNull().default("attivo"),
  /** ultima scadenza già generata */
  rateGenerateFino: date("rate_generate_fino"),
  ...timestamps,
  deletedAt: deletedAt(),
});

export const rate = pgTable(
  "rate",
  {
    id: id(),
    abbonamentoId: uuid("abbonamento_id").references(() => abbonamenti.id),
    preventivoId: uuid("preventivo_id").references(() => preventivi.id),
    fatturaId: uuid("fattura_id").references(() => fatture.id),
    ragioneSocialeId: uuid("ragione_sociale_id")
      .notNull()
      .references(() => ragioniSociali.id),
    clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id),
    numero: integer("numero").notNull().default(1),
    descrizione: text("descrizione").notNull(),
    scadenza: date("scadenza").notNull(),
    importoCent: integer("importo_cent").notNull(),
    stato: statoRataEnum("stato").notNull().default("da_incassare"),
    ...timestamps,
  },
  (t) => [
    index("rate_scadenza_idx").on(t.scadenza),
    // generazione idempotente: una sola rata per abbonamento e scadenza
    uniqueIndex("rate_abbonamento_scadenza_uq").on(t.abbonamentoId, t.scadenza),
  ],
);

export const incassi = pgTable("incassi", {
  id: id(),
  contoId: uuid("conto_id")
    .notNull()
    .references(() => conti.id),
  ragioneSocialeId: uuid("ragione_sociale_id").references(() => ragioniSociali.id),
  clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id),
  rataId: uuid("rata_id").references(() => rate.id),
  fatturaId: uuid("fattura_id").references(() => fatture.id),
  data: date("data").notNull(),
  importoCent: integer("importo_cent").notNull(),
  descrizione: text("descrizione"),
  riferimento: text("riferimento"),
  ...timestamps,
  deletedAt: deletedAt(),
});

/** Prima nota: nessun collegamento a conti bancari reali, nessuna riconciliazione. */
export const movimenti = pgTable(
  "movimenti",
  {
    id: id(),
    tipo: tipoMovimentoEnum("tipo").notNull(),
    data: date("data").notNull(),
    importoCent: integer("importo_cent").notNull(),
    contoId: uuid("conto_id")
      .notNull()
      .references(() => conti.id),
    /** solo per i giroconti */
    contoDestinazioneId: uuid("conto_destinazione_id").references(() => conti.id),
    categoria: text("categoria"),
    descrizione: text("descrizione"),
    incassoId: uuid("incasso_id").references(() => incassi.id),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [index("movimenti_data_idx").on(t.data)],
);

export const solleciti = pgTable("solleciti", {
  id: id(),
  rataId: uuid("rata_id")
    .notNull()
    .references(() => rate.id, { onDelete: "cascade" }),
  livello: integer("livello").notNull().default(1),
  programmatoIl: timestamp("programmato_il", { withTimezone: true }).notNull(),
  inviatoIl: timestamp("inviato_il", { withTimezone: true }),
  /** `da_confermare`: bozza proposta dal worker, mai inviata senza conferma dell'admin */
  stato: statoSollecitoEnum("stato").notNull().default("programmato"),
  destinatario: text("destinatario"),
  oggetto: text("oggetto"),
  corpo: text("corpo"),
  ...timestamps,
});
