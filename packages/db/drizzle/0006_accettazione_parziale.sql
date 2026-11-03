ALTER TYPE "public"."stato_preventivo" ADD VALUE 'accettato_parzialmente';--> statement-breakpoint
ALTER TABLE "preventivi" ADD COLUMN "imponibile_accettato_cent" integer;--> statement-breakpoint
ALTER TABLE "preventivi" ADD COLUMN "iva_accettata_cent" integer;--> statement-breakpoint
ALTER TABLE "preventivi" ADD COLUMN "bollo_accettato_cent" integer;--> statement-breakpoint
ALTER TABLE "preventivi" ADD COLUMN "totale_accettato_cent" integer;--> statement-breakpoint
ALTER TABLE "preventivi" ADD COLUMN "data_accettazione" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preventivo_righe" ADD COLUMN "gruppo_alternativa_id" uuid;--> statement-breakpoint
ALTER TABLE "preventivo_righe" ADD COLUMN "accettata" boolean;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD COLUMN "preventivo_riga_id" uuid;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD CONSTRAINT "abbonamenti_preventivo_riga_id_preventivo_righe_id_fk" FOREIGN KEY ("preventivo_riga_id") REFERENCES "public"."preventivo_righe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fatture_preventivo_uq" ON "fatture" USING btree ("preventivo_id") WHERE "fatture"."origine" = 'preventivo' and "fatture"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "abbonamenti" ADD CONSTRAINT "abbonamenti_preventivo_riga_id_unique" UNIQUE("preventivo_riga_id");--> statement-breakpoint
-- Preventivi già accettati prima di questa migrazione: l'accettazione era totale, quindi le loro righe
-- risultano accettate e i totali accettati coincidono con l'offerta. Idempotente (agisce solo sui nulli);
-- non tocca gli importi originali e non crea abbonamenti (vedi docs/dominio.md, «Preventivi storici»).
UPDATE "preventivo_righe" SET "accettata" = true WHERE "accettata" IS NULL AND "preventivo_id" IN (SELECT "id" FROM "preventivi" WHERE "stato" = 'accettato');--> statement-breakpoint
UPDATE "preventivi" SET "imponibile_accettato_cent" = "imponibile_cent", "iva_accettata_cent" = "iva_cent", "bollo_accettato_cent" = "bollo_cent", "totale_accettato_cent" = "totale_cent", "data_accettazione" = "updated_at" WHERE "stato" = 'accettato' AND "totale_accettato_cent" IS NULL;
