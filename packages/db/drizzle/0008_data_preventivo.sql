ALTER TABLE "preventivi" ADD COLUMN "data_preventivo" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
-- I preventivi già esistenti hanno la data in cui sono stati creati.
UPDATE "preventivi" SET "data_preventivo" = ("created_at" AT TIME ZONE 'Europe/Rome')::date;
