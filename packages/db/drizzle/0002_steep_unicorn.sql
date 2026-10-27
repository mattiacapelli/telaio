ALTER TYPE "public"."stato_sollecito" ADD VALUE IF NOT EXISTS 'da_confermare';--> statement-breakpoint
ALTER TABLE "solleciti" ADD COLUMN IF NOT EXISTS "destinatario" text;