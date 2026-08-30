-- Unità di misura come enum. I dati esistenti usano 'h' → ORE.
CREATE TYPE "UnitaMisura" AS ENUM ('ORE', 'GIORNI', 'CORPO', 'PEZZI');

ALTER TABLE "VocePreventivo" ADD COLUMN "unita_nuova" "UnitaMisura" NOT NULL DEFAULT 'ORE';
UPDATE "VocePreventivo" SET "unita_nuova" = CASE
  WHEN lower("unita") IN ('h', 'ore', 'ora') THEN 'ORE'::"UnitaMisura"
  WHEN lower("unita") IN ('g', 'gg', 'giorni', 'giorno') THEN 'GIORNI'::"UnitaMisura"
  WHEN lower("unita") IN ('corpo', 'a corpo') THEN 'CORPO'::"UnitaMisura"
  WHEN lower("unita") IN ('pz', 'pezzi') THEN 'PEZZI'::"UnitaMisura"
  ELSE 'ORE'::"UnitaMisura"
END;
ALTER TABLE "VocePreventivo" DROP COLUMN "unita";
ALTER TABLE "VocePreventivo" RENAME COLUMN "unita_nuova" TO "unita";

-- Nuovi campi di riga.
ALTER TABLE "VocePreventivo" ADD COLUMN "nota" TEXT;
ALTER TABLE "VocePreventivo" ADD COLUMN "sconto" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Testata: fiscale, classificazione e testi del documento.
ALTER TABLE "Preventivo" ADD COLUMN "referenteId" TEXT;
ALTER TABLE "Preventivo" ADD COLUMN "scontoPercento" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Preventivo" ADD COLUMN "aliquotaIva" DECIMAL(5,2) NOT NULL DEFAULT 22;
ALTER TABLE "Preventivo" ADD COLUMN "probabilita" INTEGER;
ALTER TABLE "Preventivo" ADD COLUMN "premessa" TEXT;
ALTER TABLE "Preventivo" ADD COLUMN "tempiConsegna" TEXT;
ALTER TABLE "Preventivo" ADD COLUMN "modalitaPagamento" TEXT;
ALTER TABLE "Preventivo" ADD COLUMN "validitaGiorni" INTEGER;
ALTER TABLE "Preventivo" ADD COLUMN "note" TEXT;

ALTER TABLE "Preventivo" ADD CONSTRAINT "Preventivo_referenteId_fkey"
  FOREIGN KEY ("referenteId") REFERENCES "Referente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Preventivo_referenteId_idx" ON "Preventivo"("referenteId");
