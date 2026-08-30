-- Modelli di stampa configurabili a blocchi.
CREATE TABLE "ModelloPdf" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ambito" TEXT NOT NULL,
    "descrizione" TEXT,
    "predefinito" BOOLEAN NOT NULL DEFAULT false,
    "blocchi" JSONB NOT NULL DEFAULT '[]',
    "stile" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelloPdf_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModelloPdf_ambito_predefinito_idx" ON "ModelloPdf"("ambito", "predefinito");

ALTER TABLE "Preventivo" ADD COLUMN "modelloPdfId" TEXT;
ALTER TABLE "Contratto" ADD COLUMN "modelloPdfId" TEXT;

ALTER TABLE "Preventivo" ADD CONSTRAINT "Preventivo_modelloPdfId_fkey"
  FOREIGN KEY ("modelloPdfId") REFERENCES "ModelloPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contratto" ADD CONSTRAINT "Contratto_modelloPdfId_fkey"
  FOREIGN KEY ("modelloPdfId") REFERENCES "ModelloPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
