CREATE TYPE "public"."stato_monte_ore" AS ENUM('attivo', 'concluso');--> statement-breakpoint
CREATE TABLE "monte_ore" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_ref_id" uuid NOT NULL,
	"preventivo_id" uuid,
	"nome" text NOT NULL,
	"minuti_incluse" integer NOT NULL,
	"tariffa_oraria_cent" integer DEFAULT 0 NOT NULL,
	"tariffa_extra_cent" integer DEFAULT 0 NOT NULL,
	"arrotondamento_minuti" integer DEFAULT 15 NOT NULL,
	"data_inizio" date NOT NULL,
	"data_fine" date,
	"stato" "stato_monte_ore" DEFAULT 'attivo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "monte_ore_minuti_positivi" CHECK ("monte_ore"."minuti_incluse" > 0),
	CONSTRAINT "monte_ore_passo_valido" CHECK ("monte_ore"."arrotondamento_minuti" in (1, 5, 15, 30, 60)),
	CONSTRAINT "monte_ore_date" CHECK ("monte_ore"."data_fine" is null or "monte_ore"."data_fine" >= "monte_ore"."data_inizio")
);
--> statement-breakpoint
CREATE TABLE "voci_tempo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_ref_id" uuid NOT NULL,
	"monte_ore_id" uuid,
	"progetto_id" uuid,
	"ticket_id" uuid,
	"data" date NOT NULL,
	"minuti_effettivi" integer DEFAULT 0 NOT NULL,
	"minuti" integer DEFAULT 0 NOT NULL,
	"descrizione" text,
	"fatturabile" boolean DEFAULT true NOT NULL,
	"avviato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "voci_tempo_minuti_non_negativi" CHECK ("voci_tempo"."minuti" >= 0 and "voci_tempo"."minuti_effettivi" >= 0)
);
--> statement-breakpoint
ALTER TABLE "monte_ore" ADD CONSTRAINT "monte_ore_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monte_ore" ADD CONSTRAINT "monte_ore_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voci_tempo" ADD CONSTRAINT "voci_tempo_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voci_tempo" ADD CONSTRAINT "voci_tempo_monte_ore_id_monte_ore_id_fk" FOREIGN KEY ("monte_ore_id") REFERENCES "public"."monte_ore"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voci_tempo" ADD CONSTRAINT "voci_tempo_progetto_id_progetti_id_fk" FOREIGN KEY ("progetto_id") REFERENCES "public"."progetti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voci_tempo" ADD CONSTRAINT "voci_tempo_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monte_ore_cliente_idx" ON "monte_ore" USING btree ("cliente_ref_id");--> statement-breakpoint
CREATE INDEX "voci_tempo_cliente_idx" ON "voci_tempo" USING btree ("cliente_ref_id","data");--> statement-breakpoint
CREATE INDEX "voci_tempo_monte_ore_idx" ON "voci_tempo" USING btree ("monte_ore_id","data");--> statement-breakpoint
CREATE INDEX "voci_tempo_ticket_idx" ON "voci_tempo" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voci_tempo_un_timer" ON "voci_tempo" USING btree ((true)) WHERE "voci_tempo"."avviato_at" is not null and "voci_tempo"."deleted_at" is null;