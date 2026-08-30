-- Testi standard riutilizzabili e testi propri dei contratti.
CREATE TABLE "TestoStandard" (
    "id" TEXT NOT NULL,
    "ambito" TEXT NOT NULL DEFAULT 'ENTRAMBI',
    "campo" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "predefinito" BOOLEAN NOT NULL DEFAULT false,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestoStandard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TestoStandard_ambito_campo_idx" ON "TestoStandard"("ambito", "campo");

ALTER TABLE "Contratto" ADD COLUMN "premessa" TEXT;
ALTER TABLE "Contratto" ADD COLUMN "oggetto" TEXT;
ALTER TABLE "Contratto" ADD COLUMN "condizioniPagamento" TEXT;
ALTER TABLE "Contratto" ADD COLUMN "condizioniServizio" TEXT;
