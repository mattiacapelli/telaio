-- Note su attività e ticket, per le rispettive schede di dettaglio.
CREATE TABLE "NotaOperativa" (
    "id" TEXT NOT NULL,
    "attivitaId" TEXT,
    "ticketId" TEXT,
    "testo" TEXT NOT NULL,
    "autore" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotaOperativa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotaOperativa_attivitaId_idx" ON "NotaOperativa"("attivitaId");
CREATE INDEX "NotaOperativa_ticketId_idx" ON "NotaOperativa"("ticketId");

ALTER TABLE "NotaOperativa" ADD CONSTRAINT "NotaOperativa_attivitaId_fkey"
  FOREIGN KEY ("attivitaId") REFERENCES "Attivita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotaOperativa" ADD CONSTRAINT "NotaOperativa_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
