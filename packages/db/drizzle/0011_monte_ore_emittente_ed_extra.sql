CREATE TABLE "monte_ore_extra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monte_ore_id" uuid NOT NULL,
	"ciclo_n" integer NOT NULL,
	"minuti" integer NOT NULL,
	"fattura_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monte_ore_extra_minuti_positivi" CHECK ("monte_ore_extra"."minuti" > 0)
);
--> statement-breakpoint
ALTER TABLE "monte_ore" ADD COLUMN "ragione_sociale_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "monte_ore_extra" ADD CONSTRAINT "monte_ore_extra_monte_ore_id_monte_ore_id_fk" FOREIGN KEY ("monte_ore_id") REFERENCES "public"."monte_ore"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monte_ore_extra" ADD CONSTRAINT "monte_ore_extra_fattura_id_fatture_id_fk" FOREIGN KEY ("fattura_id") REFERENCES "public"."fatture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monte_ore_extra_idx" ON "monte_ore_extra" USING btree ("monte_ore_id","ciclo_n");--> statement-breakpoint
ALTER TABLE "monte_ore" ADD CONSTRAINT "monte_ore_ragione_sociale_id_ragioni_sociali_id_fk" FOREIGN KEY ("ragione_sociale_id") REFERENCES "public"."ragioni_sociali"("id") ON DELETE no action ON UPDATE no action;