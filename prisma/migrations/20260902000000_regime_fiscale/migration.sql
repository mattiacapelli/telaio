-- Anagrafica del regime fiscale, scorporata dal campo testuale libero di
-- Azienda (che resta la dicitura da stampare). Alimenta il calcolatore
-- fiscale realtime della dashboard Tasse.

CREATE TABLE "RegimeFiscale" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "coefficienteRedditivita" DECIMAL(5,2) NOT NULL,
    "aliquotaSostitutiva" DECIMAL(5,2) NOT NULL,
    "aliquotaInps" DECIMAL(5,2) NOT NULL,
    "minimaleInps" DECIMAL(12,2),
    "predefinito" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminataIl" TIMESTAMP(3),
    CONSTRAINT "RegimeFiscale_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegimeFiscale_eliminataIl_idx" ON "RegimeFiscale"("eliminataIl");

ALTER TABLE "Azienda" ADD COLUMN "regimeFiscaleId" TEXT;
CREATE INDEX "Azienda_regimeFiscaleId_idx" ON "Azienda"("regimeFiscaleId");
ALTER TABLE "Azienda" ADD CONSTRAINT "Azienda_regimeFiscaleId_fkey"
    FOREIGN KEY ("regimeFiscaleId") REFERENCES "RegimeFiscale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
