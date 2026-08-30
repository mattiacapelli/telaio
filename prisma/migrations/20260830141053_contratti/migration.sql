-- Contratti (assistenza a ore, canone fisso, di progetto) e allegati
-- estesi a ticket e contratti.
CREATE TYPE "TipoContratto" AS ENUM ('ASSISTENZA_ORE', 'CANONE_FISSO', 'PROGETTO');
CREATE TYPE "PeriodicitaContratto" AS ENUM ('MENSILE', 'TRIMESTRALE', 'SEMESTRALE', 'ANNUALE');
CREATE TYPE "StatoContratto" AS ENUM ('BOZZA', 'ATTIVO', 'SOSPESO', 'SCADUTO', 'DISDETTO');

CREATE TABLE "Contratto" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "progettoId" TEXT,
    "tipo" "TipoContratto" NOT NULL DEFAULT 'ASSISTENZA_ORE',
    "stato" "StatoContratto" NOT NULL DEFAULT 'BOZZA',
    "canone" DECIMAL(12,2) NOT NULL,
    "periodicita" "PeriodicitaContratto" NOT NULL DEFAULT 'MENSILE',
    "monteOre" DECIMAL(10,2),
    "tariffaExtra" DECIMAL(10,2),
    "inizioIl" TIMESTAMP(3) NOT NULL,
    "scadeIl" TIMESTAMP(3),
    "rinnovoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "preavvisoGiorni" INTEGER NOT NULL DEFAULT 30,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contratto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodoContratto" (
    "id" TEXT NOT NULL,
    "contrattoId" TEXT NOT NULL,
    "inizioIl" DATE NOT NULL,
    "fineIl" DATE NOT NULL,
    "monteOre" DECIMAL(10,2),
    "fatturaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoContratto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contratto_numero_key" ON "Contratto"("numero");
CREATE INDEX "Contratto_clienteId_idx" ON "Contratto"("clienteId");
CREATE INDEX "Contratto_stato_idx" ON "Contratto"("stato");
CREATE UNIQUE INDEX "PeriodoContratto_contrattoId_inizioIl_key" ON "PeriodoContratto"("contrattoId", "inizioIl");
CREATE INDEX "PeriodoContratto_contrattoId_idx" ON "PeriodoContratto"("contrattoId");

ALTER TABLE "Contratto" ADD CONSTRAINT "Contratto_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contratto" ADD CONSTRAINT "Contratto_progettoId_fkey"
  FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PeriodoContratto" ADD CONSTRAINT "PeriodoContratto_contrattoId_fkey"
  FOREIGN KEY ("contrattoId") REFERENCES "Contratto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ticket collegato a un contratto.
ALTER TABLE "Ticket" ADD COLUMN "contrattoId" TEXT;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_contrattoId_fkey"
  FOREIGN KEY ("contrattoId") REFERENCES "Contratto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Documenti allegabili anche a ticket e contratti: progettoId diventa opzionale.
ALTER TABLE "Documento" ALTER COLUMN "progettoId" DROP NOT NULL;
ALTER TABLE "Documento" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "Documento" ADD COLUMN "contrattoId" TEXT;
CREATE INDEX "Documento_ticketId_idx" ON "Documento"("ticketId");
CREATE INDEX "Documento_contrattoId_idx" ON "Documento"("contrattoId");
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_contrattoId_fkey"
  FOREIGN KEY ("contrattoId") REFERENCES "Contratto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
