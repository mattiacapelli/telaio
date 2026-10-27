import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientiRef, ragioniSociali } from "./anagrafiche";
import { deletedAt, id, timestamps } from "./helpers";

export const statoPreventivoEnum = pgEnum("stato_preventivo", [
  "bozza",
  "inviato",
  "in_revisione",
  "accettato",
  "rifiutato",
  "scaduto",
]);
export const statoFatturaEnum = pgEnum("stato_fattura", [
  "bozza",
  "emessa",
  "inviata_sdi",
  "consegnata",
  "scartata",
  "parzialmente_pagata",
  "pagata",
]);
export const tipoRigaEnum = pgEnum("tipo_riga", ["una_tantum", "canone_annuo", "canone_mensile"]);
export const origineFatturaEnum = pgEnum("origine_fattura", ["preventivo", "rata", "libera"]);

/** Copia congelata di emittente, cliente e regole IVA. */
export interface SnapshotDocumento {
  emittente: Record<string, unknown>;
  cliente: Record<string, unknown>;
  regole: Record<string, unknown>;
}

const totali = {
  imponibileCent: integer("imponibile_cent").notNull().default(0),
  ivaCent: integer("iva_cent").notNull().default(0),
  bolloCent: integer("bollo_cent").notNull().default(0),
  totaleCent: integer("totale_cent").notNull().default(0),
};

export const preventivi = pgTable(
  "preventivi",
  {
    id: id(),
    ragioneSocialeId: uuid("ragione_sociale_id")
      .notNull()
      .references(() => ragioniSociali.id),
    clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id),
    twentyOpportunityId: text("twenty_opportunity_id"),
    /** assegnato all'invio, in modo atomico */
    numero: text("numero"),
    anno: integer("anno").notNull(),
    stato: statoPreventivoEnum("stato").notNull().default("bozza"),
    oggetto: text("oggetto").notNull(),
    note: text("note"),
    validoFino: date("valido_fino"),
    snapshot: jsonb("snapshot").$type<SnapshotDocumento>().notNull(),
    ...totali,
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("preventivi_stato_idx").on(t.stato),
    uniqueIndex("preventivi_numero_uq").on(t.ragioneSocialeId, t.anno, t.numero),
  ],
);

export const preventivoRighe = pgTable(
  "preventivo_righe",
  {
    id: id(),
    preventivoId: uuid("preventivo_id")
      .notNull()
      .references(() => preventivi.id, { onDelete: "cascade" }),
    posizione: integer("posizione").notNull().default(0),
    descrizione: text("descrizione").notNull(),
    tipo: tipoRigaEnum("tipo").notNull().default("una_tantum"),
    quantita: integer("quantita").notNull().default(1),
    prezzoUnitarioCent: integer("prezzo_unitario_cent").notNull(),
    scontoBp: integer("sconto_bp").notNull().default(0),
    importoCent: integer("importo_cent").notNull(),
    /** voce di listino di origine (base o modulo); nullo per righe libere */
    voceListinoId: uuid("voce_listino_id"),
    ...timestamps,
  },
  (t) => [index("preventivo_righe_prev_idx").on(t.preventivoId)],
);

export const fatture = pgTable(
  "fatture",
  {
    id: id(),
    ragioneSocialeId: uuid("ragione_sociale_id")
      .notNull()
      .references(() => ragioniSociali.id),
    /** nullo per clienti occasionali o privati: i dati stanno nello snapshot */
    clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id),
    origine: origineFatturaEnum("origine").notNull().default("libera"),
    preventivoId: uuid("preventivo_id").references(() => preventivi.id),
    rataId: uuid("rata_id"),
    numero: text("numero"),
    anno: integer("anno").notNull(),
    stato: statoFatturaEnum("stato").notNull().default("bozza"),
    dataEmissione: date("data_emissione"),
    scadenza: date("scadenza"),
    note: text("note"),
    snapshot: jsonb("snapshot").$type<SnapshotDocumento>().notNull(),
    ...totali,
    ritenutaCent: integer("ritenuta_cent").notNull().default(0),
    ivaSplitCent: integer("iva_split_cent").notNull().default(0),
    nettoDaPagareCent: integer("netto_da_pagare_cent").notNull().default(0),
    /** fatturazione elettronica tramite intermediario */
    sdiIdentificativo: text("sdi_identificativo"),
    sdiMessaggio: text("sdi_messaggio"),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("fatture_stato_idx").on(t.stato),
    uniqueIndex("fatture_numero_uq").on(t.ragioneSocialeId, t.anno, t.numero),
  ],
);

export const fatturaRighe = pgTable(
  "fattura_righe",
  {
    id: id(),
    fatturaId: uuid("fattura_id")
      .notNull()
      .references(() => fatture.id, { onDelete: "cascade" }),
    posizione: integer("posizione").notNull().default(0),
    descrizione: text("descrizione").notNull(),
    quantita: integer("quantita").notNull().default(1),
    prezzoUnitarioCent: integer("prezzo_unitario_cent").notNull(),
    scontoBp: integer("sconto_bp").notNull().default(0),
    importoCent: integer("importo_cent").notNull(),
    ...timestamps,
  },
  (t) => [index("fattura_righe_fattura_idx").on(t.fatturaId)],
);
