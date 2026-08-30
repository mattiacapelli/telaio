-- Workflow configurabili a blocchi, registro esecuzioni e notifiche interne.
CREATE TYPE "TipoInnesco" AS ENUM ('EVENTO', 'PIANIFICATO', 'MANUALE');

CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "innesco" "TipoInnesco" NOT NULL DEFAULT 'EVENTO',
    "eventoChiave" TEXT,
    "condizioni" JSONB NOT NULL DEFAULT '[]',
    "azioni" JSONB NOT NULL DEFAULT '[]',
    "esecuzioni" INTEGER NOT NULL DEFAULT 0,
    "ultimaEsecuzione" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistroWorkflow" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "successo" BOOLEAN NOT NULL,
    "esito" TEXT NOT NULL,
    "dettaglio" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notifica" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "testo" TEXT,
    "link" TEXT,
    "livello" TEXT NOT NULL DEFAULT 'info',
    "lettaIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notifica_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Workflow_innesco_attivo_idx" ON "Workflow"("innesco", "attivo");
CREATE INDEX "RegistroWorkflow_workflowId_createdAt_idx" ON "RegistroWorkflow"("workflowId", "createdAt");
CREATE INDEX "Notifica_lettaIl_createdAt_idx" ON "Notifica"("lettaIl", "createdAt");

ALTER TABLE "RegistroWorkflow" ADD CONSTRAINT "RegistroWorkflow_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
