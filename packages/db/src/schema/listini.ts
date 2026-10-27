import { boolean, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { ragioniSociali } from "./anagrafiche";
import { deletedAt, id, timestamps } from "./helpers";

export const listini = pgTable("listini", {
  id: id(),
  ragioneSocialeId: uuid("ragione_sociale_id")
    .notNull()
    .references(() => ragioniSociali.id),
  nome: text("nome").notNull(),
  descrizione: text("descrizione"),
  attivo: boolean("attivo").notNull().default(true),
  ...timestamps,
  deletedAt: deletedAt(),
});

const prezzi = {
  unaTantumCent: integer("una_tantum_cent").notNull().default(0),
  canoneAnnuoCent: integer("canone_annuo_cent").notNull().default(0),
  canoneMensileCent: integer("canone_mensile_cent").notNull().default(0),
};

export const listinoBasi = pgTable(
  "listino_basi",
  {
    id: id(),
    listinoId: uuid("listino_id")
      .notNull()
      .references(() => listini.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    descrizione: text("descrizione"),
    ...prezzi,
    ordine: integer("ordine").notNull().default(0),
    attivo: boolean("attivo").notNull().default(true),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [index("listino_basi_listino_idx").on(t.listinoId)],
);

export const listinoModuli = pgTable(
  "listino_moduli",
  {
    id: id(),
    listinoId: uuid("listino_id")
      .notNull()
      .references(() => listini.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    descrizione: text("descrizione"),
    ...prezzi,
    ordine: integer("ordine").notNull().default(0),
    attivo: boolean("attivo").notNull().default(true),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [index("listino_moduli_listino_idx").on(t.listinoId)],
);

/** Molti-a-molti: un modulo è assegnabile a una o più basi. */
export const moduloBasi = pgTable(
  "modulo_basi",
  {
    moduloId: uuid("modulo_id")
      .notNull()
      .references(() => listinoModuli.id, { onDelete: "cascade" }),
    baseId: uuid("base_id")
      .notNull()
      .references(() => listinoBasi.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.moduloId, t.baseId] })],
);
