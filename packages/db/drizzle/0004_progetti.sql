CREATE TYPE "public"."ambiente_risorsa" AS ENUM('development', 'staging', 'production');--> statement-breakpoint
CREATE TYPE "public"."categoria_progetto" AS ENUM('software', 'sito_web', 'ecommerce', 'infrastruttura', 'consulenza', 'altro');--> statement-breakpoint
CREATE TYPE "public"."priorita_progetto" AS ENUM('bassa', 'normale', 'alta', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."stato_progetto" AS ENUM('pianificato', 'in_corso', 'in_attesa', 'completato', 'annullato');--> statement-breakpoint
CREATE TYPE "public"."tipo_risorsa_progetto" AS ENUM('repository', 'design', 'production', 'staging', 'documentation', 'infrastructure', 'monitoring', 'other');--> statement-breakpoint
CREATE TABLE "progetti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codice" text NOT NULL,
	"nome" text NOT NULL,
	"descrizione" text,
	"categoria" "categoria_progetto" DEFAULT 'altro' NOT NULL,
	"stato" "stato_progetto" DEFAULT 'pianificato' NOT NULL,
	"priorita" "priorita_progetto" DEFAULT 'normale' NOT NULL,
	"cliente_ref_id" uuid,
	"preventivo_id" uuid,
	"responsabile_id" text,
	"data_inizio_prevista" date,
	"data_fine_prevista" date,
	"data_inizio_effettiva" date,
	"data_fine_effettiva" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "progetti_codice_unique" UNIQUE("codice")
);
--> statement-breakpoint
CREATE TABLE "progetti_numerazione" (
	"anno" integer PRIMARY KEY NOT NULL,
	"ultimo" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progetto_risorse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progetto_id" uuid NOT NULL,
	"tipo" "tipo_risorsa_progetto" DEFAULT 'other' NOT NULL,
	"titolo" text NOT NULL,
	"url" text NOT NULL,
	"descrizione" text,
	"ambiente" "ambiente_risorsa",
	"principale" boolean DEFAULT false NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progetti" ADD CONSTRAINT "progetti_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetti" ADD CONSTRAINT "progetti_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetti" ADD CONSTRAINT "progetti_responsabile_id_users_id_fk" FOREIGN KEY ("responsabile_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetto_risorse" ADD CONSTRAINT "progetto_risorse_progetto_id_progetti_id_fk" FOREIGN KEY ("progetto_id") REFERENCES "public"."progetti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "progetti_preventivo_uq" ON "progetti" USING btree ("preventivo_id");--> statement-breakpoint
CREATE INDEX "progetti_stato_idx" ON "progetti" USING btree ("stato");--> statement-breakpoint
CREATE INDEX "progetti_cliente_idx" ON "progetti" USING btree ("cliente_ref_id");--> statement-breakpoint
CREATE INDEX "progetti_categoria_idx" ON "progetti" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "progetti_responsabile_idx" ON "progetti" USING btree ("responsabile_id");--> statement-breakpoint
CREATE INDEX "progetti_updated_idx" ON "progetti" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "progetto_risorse_progetto_idx" ON "progetto_risorse" USING btree ("progetto_id","ordine");--> statement-breakpoint
CREATE UNIQUE INDEX "progetto_risorse_principale_uq" ON "progetto_risorse" USING btree ("progetto_id") WHERE "progetto_risorse"."principale";