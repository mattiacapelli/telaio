-- Soft delete: un record eliminato non compare nelle liste ma resta
-- recuperabile dal cestino finché non lo si elimina definitivamente.

ALTER TABLE "Cliente" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Preventivo" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Progetto" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Documento" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Attivita" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "RegistrazioneOre" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Costo" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Fattura" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Contratto" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "Workflow" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "ModelloPdf" ADD COLUMN "eliminataIl" TIMESTAMP(3);
ALTER TABLE "TestoStandard" ADD COLUMN "eliminataIl" TIMESTAMP(3);

CREATE INDEX "Cliente_eliminataIl_idx" ON "Cliente"("eliminataIl");
CREATE INDEX "Preventivo_eliminataIl_idx" ON "Preventivo"("eliminataIl");
CREATE INDEX "Progetto_eliminataIl_idx" ON "Progetto"("eliminataIl");
CREATE INDEX "Documento_eliminataIl_idx" ON "Documento"("eliminataIl");
CREATE INDEX "Attivita_eliminataIl_idx" ON "Attivita"("eliminataIl");
CREATE INDEX "Ticket_eliminataIl_idx" ON "Ticket"("eliminataIl");
CREATE INDEX "RegistrazioneOre_eliminataIl_idx" ON "RegistrazioneOre"("eliminataIl");
CREATE INDEX "Costo_eliminataIl_idx" ON "Costo"("eliminataIl");
CREATE INDEX "Fattura_eliminataIl_idx" ON "Fattura"("eliminataIl");
CREATE INDEX "Contratto_eliminataIl_idx" ON "Contratto"("eliminataIl");
CREATE INDEX "Workflow_eliminataIl_idx" ON "Workflow"("eliminataIl");
CREATE INDEX "ModelloPdf_eliminataIl_idx" ON "ModelloPdf"("eliminataIl");
CREATE INDEX "TestoStandard_eliminataIl_idx" ON "TestoStandard"("eliminataIl");
