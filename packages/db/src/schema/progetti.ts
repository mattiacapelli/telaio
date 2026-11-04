import {
  AMBIENTI_RISORSA,
  CATEGORIE_PROGETTO,
  PRIORITA_PROGETTO,
  STATI_PROGETTO,
  TIPI_RISORSA,
} from "@telaio/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clientiRef } from "./anagrafiche";
import { users } from "./auth";
import { preventivi } from "./documenti";
import { deletedAt, id, timestamps } from "./helpers";

export const categoriaProgettoEnum = pgEnum("categoria_progetto", CATEGORIE_PROGETTO);
export const statoProgettoEnum = pgEnum("stato_progetto", STATI_PROGETTO);
export const prioritaProgettoEnum = pgEnum("priorita_progetto", PRIORITA_PROGETTO);
export const tipoRisorsaProgettoEnum = pgEnum("tipo_risorsa_progetto", TIPI_RISORSA);
export const ambienteRisorsaEnum = pgEnum("ambiente_risorsa", AMBIENTI_RISORSA);

/**
 * Commessa o lavoro per un cliente. Il cliente resta un riferimento a Twenty (`clienti_ref`);
 * il preventivo di origine è opzionale e ne può generare al massimo uno.
 */
export const progetti = pgTable(
  "progetti",
  {
    id: id(),
    /** Generato dal sistema (PRJ-AAAA-NNN), mai modificabile. */
    codice: text("codice").notNull().unique(),
    nome: text("nome").notNull(),
    descrizione: text("descrizione"),
    categoria: categoriaProgettoEnum("categoria").notNull().default("altro"),
    stato: statoProgettoEnum("stato").notNull().default("pianificato"),
    priorita: prioritaProgettoEnum("priorita").notNull().default("normale"),
    clienteRefId: uuid("cliente_ref_id").references(() => clientiRef.id),
    preventivoId: uuid("preventivo_id").references(() => preventivi.id),
    responsabileId: text("responsabile_id").references(() => users.id, { onDelete: "set null" }),
    dataInizioPrevista: date("data_inizio_prevista"),
    dataFinePrevista: date("data_fine_prevista"),
    dataInizioEffettiva: date("data_inizio_effettiva"),
    dataFineEffettiva: date("data_fine_effettiva"),
    /** ultimo numero assegnato a un ticket del progetto: si incrementa nella transazione del ticket */
    ultimoTicket: integer("ultimo_ticket").notNull().default(0),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    // Un preventivo può generare più progetti (due lavori nello stesso preventivo).
    index("progetti_preventivo_idx").on(t.preventivoId),
    index("progetti_stato_idx").on(t.stato),
    index("progetti_cliente_idx").on(t.clienteRefId),
    index("progetti_categoria_idx").on(t.categoria),
    index("progetti_responsabile_idx").on(t.responsabileId),
    index("progetti_updated_idx").on(t.updatedAt),
  ],
);

/** Contatore annuale dei codici progetto: si incrementa nella transazione che crea il progetto. */
export const progettiNumerazione = pgTable("progetti_numerazione", {
  anno: integer("anno").primaryKey(),
  ultimo: integer("ultimo").notNull().default(0),
});

/** Collegamenti esterni di un progetto (repository, design, ambienti, monitoraggio…). */
export const progettoRisorse = pgTable(
  "progetto_risorse",
  {
    id: id(),
    progettoId: uuid("progetto_id")
      .notNull()
      .references(() => progetti.id, { onDelete: "cascade" }),
    tipo: tipoRisorsaProgettoEnum("tipo").notNull().default("other"),
    titolo: text("titolo").notNull(),
    url: text("url").notNull(),
    descrizione: text("descrizione"),
    ambiente: ambienteRisorsaEnum("ambiente"),
    principale: boolean("principale").notNull().default(false),
    ordine: integer("ordine").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("progetto_risorse_progetto_idx").on(t.progettoId, t.ordine),
    // Al più un collegamento principale per progetto.
    uniqueIndex("progetto_risorse_principale_uq").on(t.progettoId).where(sql`${t.principale}`),
  ],
);
