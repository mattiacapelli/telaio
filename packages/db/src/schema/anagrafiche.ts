import { type AnyPgColumn, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deletedAt, id, timestamps } from "./helpers";

export const tipoContoEnum = pgEnum("tipo_conto", ["bonifico", "contante", "carta"]);

export const ragioniSociali = pgTable("ragioni_sociali", {
  id: id(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().default("ditta_individuale"),
  partitaIva: text("partita_iva"),
  codiceFiscale: text("codice_fiscale"),
  indirizzo: text("indirizzo"),
  cap: text("cap"),
  citta: text("citta"),
  provincia: text("provincia"),
  email: text("email"),
  pec: text("pec"),
  codiceSdi: text("codice_sdi"),
  iban: text("iban"),
  formatoPreventivo: text("formato_preventivo").notNull().default("P-{AAAA}-{NNN}"),
  formatoFattura: text("formato_fattura").notNull().default("F-{AAAA}-{NNN}"),
  // regole fiscali (valori monetari in centesimi, percentuali in punti base)
  ivaAttiva: boolean("iva_attiva").notNull().default(true),
  aliquotaIvaBp: integer("aliquota_iva_bp").notNull().default(2200),
  naturaSenzaIva: text("natura_senza_iva"),
  diciturSenzaIva: text("dicitura_senza_iva"),
  bolloAutomatico: boolean("bollo_automatico").notNull().default(false),
  ritenutaBp: integer("ritenuta_bp"),
  splitPayment: boolean("split_payment").notNull().default(false),
  contoPredefinitoId: uuid("conto_predefinito_id").references((): AnyPgColumn => conti.id, {
    onDelete: "set null",
  }),
  ...timestamps,
  deletedAt: deletedAt(),
});

export const conti = pgTable("conti", {
  id: id(),
  /** nullo per conti trasversali (cassa contanti, Stripe) */
  ragioneSocialeId: uuid("ragione_sociale_id").references(() => ragioniSociali.id),
  nome: text("nome").notNull(),
  tipo: tipoContoEnum("tipo").notNull(),
  saldoInizialeCent: integer("saldo_iniziale_cent").notNull().default(0),
  iban: text("iban"),
  attivo: boolean("attivo").notNull().default(true),
  ...timestamps,
  deletedAt: deletedAt(),
});

/** Riferimento locale a una Company di Twenty: la fonte di verità resta Twenty. */
export const clientiRef = pgTable(
  "clienti_ref",
  {
    id: id(),
    twentyCompanyId: text("twenty_company_id").unique(),
    nome: text("nome").notNull(),
    partitaIva: text("partita_iva"),
    codiceFiscale: text("codice_fiscale"),
    pec: text("pec"),
    codiceSdi: text("codice_sdi"),
    pa: boolean("pa").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: deletedAt(),
  },
  (t) => [index("clienti_ref_nome_idx").on(t.nome)],
);
