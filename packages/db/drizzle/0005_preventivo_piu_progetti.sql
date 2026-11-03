DROP INDEX "progetti_preventivo_uq";--> statement-breakpoint
CREATE INDEX "progetti_preventivo_idx" ON "progetti" USING btree ("preventivo_id");