import { PASSI_ARROTONDAMENTO, STATI_MONTE_ORE } from "@telaio/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { clientiRef, ragioniSociali } from "./anagrafiche";
import { fatture, preventivi } from "./documenti";
import { deletedAt, id, timestamps } from "./helpers";
import { progetti } from "./progetti";
import { ticket } from "./ticket";

export const statoMonteOreEnum = pgEnum("stato_monte_ore", STATI_MONTE_ORE);

/**
 * Contratto a ore: un cliente compra un numero di ore per periodo (es. 10 ore al mese). I periodi
 * sono mensili e partono dal giorno di `data_inizio`; le ore non usate decadono a fine periodo.
 * Il saldo non si salva: si calcola dalle voci di tempo.
 */
export const monteOre = pgTable(
  "monte_ore",
  {
    id: id(),
    clienteRefId: uuid("cliente_ref_id")
      .notNull()
      .references(() => clientiRef.id),
    /** chi emette fatture ed estratti per questo contratto */
    ragioneSocialeId: uuid("ragione_sociale_id")
      .notNull()
      .references(() => ragioniSociali.id),
    /** il preventivo accettato da cui nasce, se c'è */
    preventivoId: uuid("preventivo_id").references(() => preventivi.id),
    nome: text("nome").notNull(),
    /** minuti inclusi in ogni periodo */
    minutiIncluse: integer("minuti_incluse").notNull(),
    /** tariffa oraria concordata, in centesimi (informativa) */
    tariffaOrariaCent: integer("tariffa_oraria_cent").notNull().default(0),
    /** tariffa delle ore oltre il monte, in centesimi */
    tariffaExtraCent: integer("tariffa_extra_cent").notNull().default(0),
    /** le voci di tempo si contano arrotondate per eccesso a questo passo */
    arrotondamentoMinuti: integer("arrotondamento_minuti").notNull().default(15),
    dataInizio: date("data_inizio").notNull(),
    dataFine: date("data_fine"),
    stato: statoMonteOreEnum("stato").notNull().default("attivo"),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("monte_ore_cliente_idx").on(t.clienteRefId),
    check("monte_ore_minuti_positivi", sql`${t.minutiIncluse} > 0`),
    check(
      "monte_ore_passo_valido",
      sql`${t.arrotondamentoMinuti} in (${sql.raw(PASSI_ARROTONDAMENTO.join(", "))})`,
    ),
    check("monte_ore_date", sql`${t.dataFine} is null or ${t.dataFine} >= ${t.dataInizio}`),
  ],
);

/**
 * Tempo lavorato. `minuti_effettivi` è quanto è stato lavorato, `minuti` quanto conta (arrotondato
 * secondo il contratto, se c'è). Un timer in corso è una voce con `avviato_at` valorizzato e zero
 * minuti; ce n'è al massimo una alla volta.
 */
export const vociTempo = pgTable(
  "voci_tempo",
  {
    id: id(),
    clienteRefId: uuid("cliente_ref_id")
      .notNull()
      .references(() => clientiRef.id),
    monteOreId: uuid("monte_ore_id").references(() => monteOre.id),
    progettoId: uuid("progetto_id").references(() => progetti.id),
    ticketId: uuid("ticket_id").references(() => ticket.id),
    data: date("data").notNull(),
    minutiEffettivi: integer("minuti_effettivi").notNull().default(0),
    minuti: integer("minuti").notNull().default(0),
    descrizione: text("descrizione"),
    fatturabile: boolean("fatturabile").notNull().default(true),
    /** valorizzato solo mentre il timer è in corso */
    avviatoAt: timestamp("avviato_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [
    index("voci_tempo_cliente_idx").on(t.clienteRefId, t.data),
    index("voci_tempo_monte_ore_idx").on(t.monteOreId, t.data),
    index("voci_tempo_ticket_idx").on(t.ticketId),
    // un solo timer in corso alla volta
    uniqueIndex("voci_tempo_un_timer")
      .on(sql`(true)`)
      .where(sql`${t.avviatoAt} is not null and ${t.deletedAt} is null`),
    check("voci_tempo_minuti_non_negativi", sql`${t.minuti} >= 0 and ${t.minutiEffettivi} >= 0`),
  ],
);

/**
 * Ore extra già messe in una fattura: serve a non fatturarle due volte. Una fattura in bozza
 * eliminata libera le sue ore (il conteggio guarda solo le fatture non eliminate).
 */
export const monteOreExtra = pgTable(
  "monte_ore_extra",
  {
    id: id(),
    monteOreId: uuid("monte_ore_id")
      .notNull()
      .references(() => monteOre.id),
    /** numero del periodo (0 per il primo) */
    cicloN: integer("ciclo_n").notNull(),
    minuti: integer("minuti").notNull(),
    fatturaId: uuid("fattura_id")
      .notNull()
      .references(() => fatture.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("monte_ore_extra_idx").on(t.monteOreId, t.cicloN),
    check("monte_ore_extra_minuti_positivi", sql`${t.minuti} > 0`),
  ],
);
