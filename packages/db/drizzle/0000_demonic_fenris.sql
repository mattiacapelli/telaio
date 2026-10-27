CREATE TYPE "public"."tipo_conto" AS ENUM('bonifico', 'contante', 'carta');--> statement-breakpoint
CREATE TYPE "public"."origine_fattura" AS ENUM('preventivo', 'rata', 'libera');--> statement-breakpoint
CREATE TYPE "public"."stato_fattura" AS ENUM('bozza', 'emessa', 'inviata_sdi', 'consegnata', 'scartata', 'parzialmente_pagata', 'pagata');--> statement-breakpoint
CREATE TYPE "public"."stato_preventivo" AS ENUM('bozza', 'inviato', 'in_revisione', 'accettato', 'rifiutato', 'scaduto');--> statement-breakpoint
CREATE TYPE "public"."tipo_riga" AS ENUM('una_tantum', 'canone_annuo', 'canone_mensile');--> statement-breakpoint
CREATE TYPE "public"."periodicita" AS ENUM('mensile', 'trimestrale', 'semestrale', 'annuale');--> statement-breakpoint
CREATE TYPE "public"."stato_abbonamento" AS ENUM('attivo', 'sospeso', 'cessato');--> statement-breakpoint
CREATE TYPE "public"."stato_rata" AS ENUM('da_incassare', 'parziale', 'incassata', 'scaduta', 'annullata');--> statement-breakpoint
CREATE TYPE "public"."stato_sollecito" AS ENUM('programmato', 'inviato', 'annullato');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimento" AS ENUM('entrata', 'uscita', 'giroconto');--> statement-breakpoint
CREATE TYPE "public"."permesso_api" AS ENUM('lettura', 'lettura_scrittura');--> statement-breakpoint
CREATE TYPE "public"."stato_delivery" AS ENUM('in_attesa', 'consegnato', 'fallito');--> statement-breakpoint
CREATE TYPE "public"."stato_pending" AS ENUM('in_attesa', 'confermata', 'rifiutata', 'fallita');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clienti_ref" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"twenty_company_id" text,
	"nome" text NOT NULL,
	"partita_iva" text,
	"codice_fiscale" text,
	"pec" text,
	"codice_sdi" text,
	"pa" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clienti_ref_twenty_company_id_unique" UNIQUE("twenty_company_id")
);
--> statement-breakpoint
CREATE TABLE "conti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ragione_sociale_id" uuid,
	"nome" text NOT NULL,
	"tipo" "tipo_conto" NOT NULL,
	"saldo_iniziale_cent" integer DEFAULT 0 NOT NULL,
	"iban" text,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ragioni_sociali" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text DEFAULT 'ditta_individuale' NOT NULL,
	"partita_iva" text,
	"codice_fiscale" text,
	"indirizzo" text,
	"cap" text,
	"citta" text,
	"provincia" text,
	"email" text,
	"pec" text,
	"codice_sdi" text,
	"iban" text,
	"formato_preventivo" text DEFAULT 'P-{AAAA}-{NNN}' NOT NULL,
	"formato_fattura" text DEFAULT 'F-{AAAA}-{NNN}' NOT NULL,
	"iva_attiva" boolean DEFAULT true NOT NULL,
	"aliquota_iva_bp" integer DEFAULT 2200 NOT NULL,
	"natura_senza_iva" text,
	"dicitura_senza_iva" text,
	"bollo_automatico" boolean DEFAULT false NOT NULL,
	"ritenuta_bp" integer,
	"split_payment" boolean DEFAULT false NOT NULL,
	"conto_predefinito_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listini" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ragione_sociale_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listino_basi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listino_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text,
	"una_tantum_cent" integer DEFAULT 0 NOT NULL,
	"canone_annuo_cent" integer DEFAULT 0 NOT NULL,
	"canone_mensile_cent" integer DEFAULT 0 NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listino_moduli" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listino_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text,
	"una_tantum_cent" integer DEFAULT 0 NOT NULL,
	"canone_annuo_cent" integer DEFAULT 0 NOT NULL,
	"canone_mensile_cent" integer DEFAULT 0 NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modulo_basi" (
	"modulo_id" uuid NOT NULL,
	"base_id" uuid NOT NULL,
	CONSTRAINT "modulo_basi_modulo_id_base_id_pk" PRIMARY KEY("modulo_id","base_id")
);
--> statement-breakpoint
CREATE TABLE "fattura_righe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fattura_id" uuid NOT NULL,
	"posizione" integer DEFAULT 0 NOT NULL,
	"descrizione" text NOT NULL,
	"quantita" integer DEFAULT 1 NOT NULL,
	"prezzo_unitario_cent" integer NOT NULL,
	"sconto_bp" integer DEFAULT 0 NOT NULL,
	"importo_cent" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fatture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ragione_sociale_id" uuid NOT NULL,
	"cliente_ref_id" uuid,
	"origine" "origine_fattura" DEFAULT 'libera' NOT NULL,
	"preventivo_id" uuid,
	"rata_id" uuid,
	"numero" text,
	"anno" integer NOT NULL,
	"stato" "stato_fattura" DEFAULT 'bozza' NOT NULL,
	"data_emissione" date,
	"scadenza" date,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"imponibile_cent" integer DEFAULT 0 NOT NULL,
	"iva_cent" integer DEFAULT 0 NOT NULL,
	"bollo_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer DEFAULT 0 NOT NULL,
	"ritenuta_cent" integer DEFAULT 0 NOT NULL,
	"iva_split_cent" integer DEFAULT 0 NOT NULL,
	"netto_da_pagare_cent" integer DEFAULT 0 NOT NULL,
	"sdi_identificativo" text,
	"sdi_messaggio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preventivi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ragione_sociale_id" uuid NOT NULL,
	"cliente_ref_id" uuid,
	"twenty_opportunity_id" text,
	"numero" text,
	"anno" integer NOT NULL,
	"stato" "stato_preventivo" DEFAULT 'bozza' NOT NULL,
	"oggetto" text NOT NULL,
	"note" text,
	"valido_fino" date,
	"snapshot" jsonb NOT NULL,
	"imponibile_cent" integer DEFAULT 0 NOT NULL,
	"iva_cent" integer DEFAULT 0 NOT NULL,
	"bollo_cent" integer DEFAULT 0 NOT NULL,
	"totale_cent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preventivo_righe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preventivo_id" uuid NOT NULL,
	"posizione" integer DEFAULT 0 NOT NULL,
	"descrizione" text NOT NULL,
	"tipo" "tipo_riga" DEFAULT 'una_tantum' NOT NULL,
	"quantita" integer DEFAULT 1 NOT NULL,
	"prezzo_unitario_cent" integer NOT NULL,
	"sconto_bp" integer DEFAULT 0 NOT NULL,
	"importo_cent" integer NOT NULL,
	"voce_listino_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abbonamenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ragione_sociale_id" uuid NOT NULL,
	"cliente_ref_id" uuid NOT NULL,
	"preventivo_id" uuid,
	"descrizione" text NOT NULL,
	"periodicita" "periodicita" NOT NULL,
	"importo_rata_cent" integer NOT NULL,
	"inizio" date NOT NULL,
	"fine" date,
	"stato" "stato_abbonamento" DEFAULT 'attivo' NOT NULL,
	"rate_generate_fino" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "incassi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conto_id" uuid NOT NULL,
	"ragione_sociale_id" uuid,
	"cliente_ref_id" uuid,
	"rata_id" uuid,
	"fattura_id" uuid,
	"data" date NOT NULL,
	"importo_cent" integer NOT NULL,
	"descrizione" text,
	"riferimento" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "movimenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_movimento" NOT NULL,
	"data" date NOT NULL,
	"importo_cent" integer NOT NULL,
	"conto_id" uuid NOT NULL,
	"conto_destinazione_id" uuid,
	"categoria" text,
	"descrizione" text,
	"incasso_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abbonamento_id" uuid,
	"preventivo_id" uuid,
	"fattura_id" uuid,
	"ragione_sociale_id" uuid NOT NULL,
	"cliente_ref_id" uuid,
	"numero" integer DEFAULT 1 NOT NULL,
	"descrizione" text NOT NULL,
	"scadenza" date NOT NULL,
	"importo_cent" integer NOT NULL,
	"stato" "stato_rata" DEFAULT 'da_incassare' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solleciti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rata_id" uuid NOT NULL,
	"livello" integer DEFAULT 1 NOT NULL,
	"programmato_il" timestamp with time zone NOT NULL,
	"inviato_il" timestamp with time zone,
	"stato" "stato_sollecito" DEFAULT 'programmato' NOT NULL,
	"oggetto" text,
	"corpo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"prefisso" text NOT NULL,
	"hash" text NOT NULL,
	"permessi" "permesso_api" DEFAULT 'lettura' NOT NULL,
	"scopes" text[] DEFAULT '{"api"}' NOT NULL,
	"created_by" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"api_key_id" uuid,
	"azione" text NOT NULL,
	"entita" text,
	"entita_id" text,
	"dettagli" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impostazioni" (
	"chiave" text PRIMARY KEY NOT NULL,
	"valore" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numerazioni" (
	"ragione_sociale_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"anno" integer NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "numerazioni_ragione_sociale_id_tipo_anno_pk" PRIMARY KEY("ragione_sociale_id","tipo","anno")
);
--> statement-breakpoint
CREATE TABLE "pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"payload" jsonb NOT NULL,
	"stato" "stato_pending" DEFAULT 'in_attesa' NOT NULL,
	"origine" text DEFAULT 'mcp' NOT NULL,
	"api_key_id" uuid,
	"risultato" jsonb,
	"errore" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"payload" jsonb NOT NULL,
	"stato" "stato_delivery" DEFAULT 'in_attesa' NOT NULL,
	"tentativi" integer DEFAULT 0 NOT NULL,
	"prossimo_tentativo" timestamp with time zone,
	"ultimo_status" integer,
	"ultimo_errore" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"eventi" text[] DEFAULT '{}' NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conti" ADD CONSTRAINT "conti_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ragioni_sociali" ADD CONSTRAINT "ragioni_sociali_conto_predefinito_id_conti_id_fk" FOREIGN KEY ("conto_predefinito_id") REFERENCES "public"."conti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listini" ADD CONSTRAINT "listini_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listino_basi" ADD CONSTRAINT "listino_basi_listino_id_listini_id_fk" FOREIGN KEY ("listino_id") REFERENCES "public"."listini"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listino_moduli" ADD CONSTRAINT "listino_moduli_listino_id_listini_id_fk" FOREIGN KEY ("listino_id") REFERENCES "public"."listini"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulo_basi" ADD CONSTRAINT "modulo_basi_modulo_id_listino_moduli_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."listino_moduli"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulo_basi" ADD CONSTRAINT "modulo_basi_base_id_listino_basi_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."listino_basi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fattura_righe" ADD CONSTRAINT "fattura_righe_fattura_id_fatture_id_fk" FOREIGN KEY ("fattura_id") REFERENCES "public"."fatture"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fatture" ADD CONSTRAINT "fatture_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fatture" ADD CONSTRAINT "fatture_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fatture" ADD CONSTRAINT "fatture_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventivi" ADD CONSTRAINT "preventivi_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventivi" ADD CONSTRAINT "preventivi_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventivo_righe" ADD CONSTRAINT "preventivo_righe_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD CONSTRAINT "abbonamenti_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD CONSTRAINT "abbonamenti_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD CONSTRAINT "abbonamenti_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incassi" ADD CONSTRAINT "incassi_conto_id_conti_id_fk" FOREIGN KEY ("conto_id") REFERENCES "public"."conti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incassi" ADD CONSTRAINT "incassi_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incassi" ADD CONSTRAINT "incassi_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incassi" ADD CONSTRAINT "incassi_rata_id_rate_id_fk" FOREIGN KEY ("rata_id") REFERENCES "public"."rate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incassi" ADD CONSTRAINT "incassi_fattura_id_fatture_id_fk" FOREIGN KEY ("fattura_id") REFERENCES "public"."fatture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti" ADD CONSTRAINT "movimenti_conto_id_conti_id_fk" FOREIGN KEY ("conto_id") REFERENCES "public"."conti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti" ADD CONSTRAINT "movimenti_conto_destinazione_id_conti_id_fk" FOREIGN KEY ("conto_destinazione_id") REFERENCES "public"."conti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimenti" ADD CONSTRAINT "movimenti_incasso_id_incassi_id_fk" FOREIGN KEY ("incasso_id") REFERENCES "public"."incassi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_abbonamento_id_abbonamenti_id_fk" FOREIGN KEY ("abbonamento_id") REFERENCES "public"."abbonamenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_fattura_id_fatture_id_fk" FOREIGN KEY ("fattura_id") REFERENCES "public"."fatture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solleciti" ADD CONSTRAINT "solleciti_rata_id_rate_id_fk" FOREIGN KEY ("rata_id") REFERENCES "public"."rate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numerazioni" ADD CONSTRAINT "numerazioni_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clienti_ref_nome_idx" ON "clienti_ref" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "listino_basi_listino_idx" ON "listino_basi" USING btree ("listino_id");--> statement-breakpoint
CREATE INDEX "listino_moduli_listino_idx" ON "listino_moduli" USING btree ("listino_id");--> statement-breakpoint
CREATE INDEX "fattura_righe_fattura_idx" ON "fattura_righe" USING btree ("fattura_id");--> statement-breakpoint
CREATE INDEX "fatture_stato_idx" ON "fatture" USING btree ("stato");--> statement-breakpoint
CREATE UNIQUE INDEX "fatture_numero_uq" ON "fatture" USING btree ("ragione_sociale_id","anno","numero");--> statement-breakpoint
CREATE INDEX "preventivi_stato_idx" ON "preventivi" USING btree ("stato");--> statement-breakpoint
CREATE UNIQUE INDEX "preventivi_numero_uq" ON "preventivi" USING btree ("ragione_sociale_id","anno","numero");--> statement-breakpoint
CREATE INDEX "preventivo_righe_prev_idx" ON "preventivo_righe" USING btree ("preventivo_id");--> statement-breakpoint
CREATE INDEX "movimenti_data_idx" ON "movimenti" USING btree ("data");--> statement-breakpoint
CREATE INDEX "rate_scadenza_idx" ON "rate" USING btree ("scadenza");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_abbonamento_scadenza_uq" ON "rate" USING btree ("abbonamento_id","scadenza");--> statement-breakpoint
CREATE INDEX "pending_actions_stato_idx" ON "pending_actions" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_stato_idx" ON "webhook_deliveries" USING btree ("stato","prossimo_tentativo");