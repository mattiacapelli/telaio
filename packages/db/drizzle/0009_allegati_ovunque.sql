ALTER TABLE "progetto_documenti" DROP CONSTRAINT "progetto_documenti_chiave_unique";--> statement-breakpoint
ALTER TABLE "progetto_documenti" ALTER COLUMN "progetto_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ALTER COLUMN "chiave" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ALTER COLUMN "dimensione_byte" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD COLUMN "preventivo_id" uuid;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD COLUMN "cliente_ref_id" uuid;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD COLUMN "tipo" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_preventivo_id_preventivi_id_fk" FOREIGN KEY ("preventivo_id") REFERENCES "public"."preventivi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_cliente_ref_id_clienti_ref_id_fk" FOREIGN KEY ("cliente_ref_id") REFERENCES "public"."clienti_ref"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progetto_documenti_preventivo_idx" ON "progetto_documenti" USING btree ("preventivo_id","created_at");--> statement-breakpoint
CREATE INDEX "progetto_documenti_cliente_idx" ON "progetto_documenti" USING btree ("cliente_ref_id","created_at");--> statement-breakpoint
CREATE INDEX "progetto_documenti_chiave_idx" ON "progetto_documenti" USING btree ("chiave");--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_un_proprietario" CHECK (num_nonnulls("progetto_documenti"."progetto_id", "progetto_documenti"."preventivo_id", "progetto_documenti"."cliente_ref_id") = 1);--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_ticket_del_progetto" CHECK ("progetto_documenti"."ticket_id" is null or "progetto_documenti"."progetto_id" is not null);--> statement-breakpoint
ALTER TABLE "progetto_documenti" ADD CONSTRAINT "progetto_documenti_file_o_link" CHECK (("progetto_documenti"."tipo" = 'file' and "progetto_documenti"."chiave" is not null and "progetto_documenti"."dimensione_byte" is not null and "progetto_documenti"."url" is null)
        or ("progetto_documenti"."tipo" = 'link' and "progetto_documenti"."url" is not null and "progetto_documenti"."chiave" is null));