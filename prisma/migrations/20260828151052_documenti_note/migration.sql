-- DropIndex
-- IF EXISTS: nell'ordine cronologico delle migrazioni questo indice viene
-- creato dopo (preventivo_completo), quindi su un database ricostruito da zero
-- qui non esiste ancora.
DROP INDEX IF EXISTS "Preventivo_referenteId_idx";

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "progettoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chiave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dimensione" INTEGER NOT NULL,
    "caricatoDa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaProgetto" (
    "id" TEXT NOT NULL,
    "progettoId" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "autore" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaProgetto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documento_chiave_key" ON "Documento"("chiave");

-- CreateIndex
CREATE INDEX "Documento_progettoId_idx" ON "Documento"("progettoId");

-- CreateIndex
CREATE INDEX "NotaProgetto_progettoId_idx" ON "NotaProgetto"("progettoId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaProgetto" ADD CONSTRAINT "NotaProgetto_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
