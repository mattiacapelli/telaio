-- Allegati anche su Prodotto, Cliente e Preventivo: lo stesso modello
-- Documento condiviso già usato da Progetto/Ticket/Contratto.

ALTER TABLE "Documento" ADD COLUMN "prodottoId" TEXT;
ALTER TABLE "Documento" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "Documento" ADD COLUMN "preventivoId" TEXT;

CREATE INDEX "Documento_prodottoId_idx" ON "Documento"("prodottoId");
CREATE INDEX "Documento_clienteId_idx" ON "Documento"("clienteId");
CREATE INDEX "Documento_preventivoId_idx" ON "Documento"("preventivoId");

ALTER TABLE "Documento" ADD CONSTRAINT "Documento_prodottoId_fkey"
    FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_preventivoId_fkey"
    FOREIGN KEY ("preventivoId") REFERENCES "Preventivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
