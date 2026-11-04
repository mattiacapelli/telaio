CREATE TYPE "public"."categoria_documento" AS ENUM('contratto', 'specifiche', 'design', 'consegna', 'altro');--> statement-breakpoint
CREATE TYPE "public"."stato_ticket" AS ENUM('backlog', 'da_fare', 'in_corso', 'in_revisione', 'completato');--> statement-breakpoint
CREATE TYPE "public"."tipo_ticket" AS ENUM('attivita', 'bug', 'richiesta', 'assistenza');--> statement-breakpoint
CREATE TABLE "progetto_documenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progetto_id" uuid NOT NULL,
	"ticket_id" uuid,
	"nome" text NOT NULL,
	"chiave" text NOT NULL,
	"dimensione_byte" integer NOT NULL,
	"tipo_mime" text DEFAULT 'application/octet-stream' NOT NULL,
	"categoria" "categoria_documento" DEFAULT 'altro' NOT NULL,
	"descrizione" text,
	"caricato_da_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "progetto_documenti_chiave_unique" UNIQUE("chiave")
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progetto_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"titolo" text NOT NULL,
	"descrizione" text,
	"tipo" "tipo_ticket" DEFAULT 'attivita' NOT NULL,
	"stato" "stato_ticket" DEFAULT 'da_fare' NOT NULL,
	"priorita" "priorita_progetto" DEFAULT 'normale' NOT NULL,
	"assegnatario_id" text,
	"segnalatore_id" text,
	"scadenza" date,
	"posizione" double precision NOT NULL,
	"completato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ticket_commenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"autore_id" text,
	"testo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progetti" ADD COLUMN "ultimo_ticket" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_progetto_id_progetti_id_fk" FOREIGN KEY ("progetto_id") REFERENCES "public"."progetti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_caricato_da_id_users_id_fk" FOREIGN KEY ("caricato_da_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_progetto_id_progetti_id_fk" FOREIGN KEY ("progetto_id") REFERENCES "public"."progetti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assegnatario_id_users_id_fk" FOREIGN KEY ("assegnatario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_segnalatore_id_users_id_fk" FOREIGN KEY ("segnalatore_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_commenti" ADD CONSTRAINT "ticket_commenti_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_commenti" ADD CONSTRAINT "ticket_commenti_autore_id_users_id_fk" FOREIGN KEY ("autore_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progetto_documenti_progetto_idx" ON "progetto_documenti" USING btree ("progetto_id","created_at");--> statement-breakpoint
CREATE INDEX "progetto_documenti_ticket_idx" ON "progetto_documenti" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_progetto_numero_uq" ON "ticket" USING btree ("progetto_id","numero");--> statement-breakpoint
CREATE INDEX "ticket_lavagna_idx" ON "ticket" USING btree ("progetto_id","stato","posizione");--> statement-breakpoint
CREATE INDEX "ticket_assegnatario_idx" ON "ticket" USING btree ("assegnatario_id");--> statement-breakpoint
CREATE INDEX "ticket_commenti_ticket_idx" ON "ticket_commenti" USING btree ("ticket_id","created_at");