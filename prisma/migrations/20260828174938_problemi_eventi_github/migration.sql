-- Criticità di progetto e diario degli eventi, più il collegamento a GitHub.
CREATE TYPE "GravitaProblema" AS ENUM ('BASSA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE "StatoProblema" AS ENUM ('APERTO', 'IN_GESTIONE', 'RISOLTO', 'ACCETTATO');

CREATE TABLE "Problema" (
    "id" TEXT NOT NULL,
    "progettoId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT,
    "gravita" "GravitaProblema" NOT NULL DEFAULT 'MEDIA',
    "stato" "StatoProblema" NOT NULL DEFAULT 'APERTO',
    "risoluzione" TEXT,
    "impattoOre" DECIMAL(10,2),
    "segnalatoDa" TEXT,
    "apertoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risoltoIl" TIMESTAMP(3),
    CONSTRAINT "Problema_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventoProgetto" (
    "id" TEXT NOT NULL,
    "progettoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "dettaglio" TEXT,
    "autore" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoProgetto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Problema_progettoId_idx" ON "Problema"("progettoId");
CREATE INDEX "Problema_stato_idx" ON "Problema"("stato");
CREATE INDEX "EventoProgetto_progettoId_createdAt_idx" ON "EventoProgetto"("progettoId", "createdAt");

ALTER TABLE "Problema" ADD CONSTRAINT "Problema_progettoId_fkey"
  FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoProgetto" ADD CONSTRAINT "EventoProgetto_progettoId_fkey"
  FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Collegamento facoltativo a una repository.
ALTER TABLE "Progetto" ADD COLUMN "repoGithub" TEXT;
ALTER TABLE "Progetto" ADD COLUMN "branchGithub" TEXT;
