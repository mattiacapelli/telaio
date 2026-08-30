-- Costi sostenuti (trasferte, materiali, licenze) accanto alle ore.
CREATE TYPE "TipoCosto" AS ENUM ('TRASFERTA', 'MATERIALE', 'LICENZA', 'SERVIZIO_TERZI', 'ALTRO');
CREATE TYPE "ModalitaTrasferta" AS ENUM ('CHILOMETRICA', 'PIE_DI_LISTA', 'FORFETTARIA');

CREATE TABLE "Costo" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoCosto" NOT NULL DEFAULT 'ALTRO',
    "descrizione" TEXT NOT NULL,
    "importo" DECIMAL(10,2) NOT NULL,
    "quantita" DECIMAL(10,2),
    "tariffa" DECIMAL(10,2),
    "modalita" "ModalitaTrasferta",
    "rimborsabile" BOOLEAN NOT NULL DEFAULT true,
    "documentoId" TEXT,
    "progettoId" TEXT,
    "attivitaId" TEXT,
    "ticketId" TEXT,
    "rigaFatturaId" TEXT,
    "registratoDa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Costo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Costo_data_idx" ON "Costo"("data");
CREATE INDEX "Costo_ticketId_idx" ON "Costo"("ticketId");
CREATE INDEX "Costo_progettoId_idx" ON "Costo"("progettoId");

ALTER TABLE "Costo" ADD CONSTRAINT "Costo_progettoId_fkey"
  FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Costo" ADD CONSTRAINT "Costo_attivitaId_fkey"
  FOREIGN KEY ("attivitaId") REFERENCES "Attivita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Costo" ADD CONSTRAINT "Costo_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Costo" ADD CONSTRAINT "Costo_rigaFatturaId_fkey"
  FOREIGN KEY ("rigaFatturaId") REFERENCES "RigaFattura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Impostazioni per il calcolo delle trasferte.
ALTER TABLE "Impostazioni" ADD COLUMN "modalitaTrasferta" "ModalitaTrasferta" NOT NULL DEFAULT 'CHILOMETRICA';
ALTER TABLE "Impostazioni" ADD COLUMN "tariffaChilometrica" DECIMAL(10,2) NOT NULL DEFAULT 0.50;
ALTER TABLE "Impostazioni" ADD COLUMN "forfaitTrasferta" DECIMAL(10,2) NOT NULL DEFAULT 30;
