import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ragioniSociali } from "./anagrafiche";
import { users } from "./auth";
import { id, timestamps } from "./helpers";

export const permessoApiEnum = pgEnum("permesso_api", ["lettura", "lettura_scrittura"]);
export const statoPendingEnum = pgEnum("stato_pending", [
  "in_attesa",
  "confermata",
  "rifiutata",
  "fallita",
]);
export const statoDeliveryEnum = pgEnum("stato_delivery", ["in_attesa", "consegnato", "fallito"]);

export const apiKeys = pgTable("api_keys", {
  id: id(),
  nome: text("nome").notNull(),
  /** primi caratteri, per riconoscere la chiave nell'elenco */
  prefisso: text("prefisso").notNull(),
  /** SHA-256 della chiave: la chiave in chiaro si mostra una sola volta */
  hash: text("hash").notNull().unique(),
  permessi: permessoApiEnum("permessi").notNull().default("lettura"),
  /** `api` e/o `mcp` */
  scopes: text("scopes").array().notNull().default(["api"]),
  createdBy: text("created_by").references(() => users.id),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

export const webhooks = pgTable("webhooks", {
  id: id(),
  url: text("url").notNull(),
  /** segreto per la firma HMAC */
  secret: text("secret").notNull(),
  eventi: text("eventi").array().notNull().default([]),
  attivo: boolean("attivo").notNull().default(true),
  ...timestamps,
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    evento: text("evento").notNull(),
    payload: jsonb("payload").notNull(),
    stato: statoDeliveryEnum("stato").notNull().default("in_attesa"),
    tentativi: integer("tentativi").notNull().default(0),
    prossimoTentativo: timestamp("prossimo_tentativo", { withTimezone: true }),
    ultimoStatus: integer("ultimo_status"),
    ultimoErrore: text("ultimo_errore"),
    ...timestamps,
  },
  (t) => [index("webhook_deliveries_stato_idx").on(t.stato, t.prossimoTentativo)],
);

/** Ogni scrittura fatta da un'AI passa di qui e attende la conferma dell'admin. */
export const pendingActions = pgTable(
  "pending_actions",
  {
    id: id(),
    tipo: text("tipo").notNull(),
    payload: jsonb("payload").notNull(),
    stato: statoPendingEnum("stato").notNull().default("in_attesa"),
    origine: text("origine").notNull().default("mcp"),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
    risultato: jsonb("risultato"),
    errore: text("errore"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("pending_actions_stato_idx").on(t.stato)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: text("user_id").references(() => users.id),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  azione: text("azione").notNull(),
  entita: text("entita"),
  entitaId: text("entita_id"),
  dettagli: jsonb("dettagli"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Contatore atomico per ragione sociale, tipo documento e anno. */
export const numerazioni = pgTable(
  "numerazioni",
  {
    ragioneSocialeId: uuid("ragione_sociale_id")
      .notNull()
      .references(() => ragioniSociali.id),
    tipo: text("tipo").notNull(),
    anno: integer("anno").notNull(),
    ultimo: integer("ultimo").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ragioneSocialeId, t.tipo, t.anno] })],
);

/** Impostazioni chiave/valore (es. strumenti MCP attivi). */
export const impostazioni = pgTable("impostazioni", {
  chiave: text("chiave").primaryKey(),
  valore: jsonb("valore").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
