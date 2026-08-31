-- Ore registrabili direttamente su un cliente, senza passare da un
-- progetto/attività/ticket: per il lavoro generico (call, consulenza
-- estemporanea) che non appartiene a nient'altro ma va comunque tracciato.

ALTER TABLE "RegistrazioneOre" ADD COLUMN "clienteId" TEXT;
CREATE INDEX "RegistrazioneOre_clienteId_idx" ON "RegistrazioneOre"("clienteId");
ALTER TABLE "RegistrazioneOre" ADD CONSTRAINT "RegistrazioneOre_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
