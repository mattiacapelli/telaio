-- API key e webhook in uscita, gestibili da UI come in Twenty.

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "suffisso" TEXT NOT NULL,
    "scadeIl" TIMESTAMP(3),
    "ultimoUsoIl" TIMESTAMP(3),
    "revocataIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");
CREATE INDEX "ApiKey_hash_idx" ON "ApiKey"("hash");

CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventi" TEXT[],
    "secret" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminataIl" TIMESTAMP(3),

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Webhook_attivo_idx" ON "Webhook"("attivo");
CREATE INDEX "Webhook_eliminataIl_idx" ON "Webhook"("eliminataIl");

CREATE TABLE "RegistroWebhook" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "successo" BOOLEAN NOT NULL,
    "statusHttp" INTEGER,
    "errore" TEXT,
    "inviataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroWebhook_webhookId_inviataIl_idx" ON "RegistroWebhook"("webhookId", "inviataIl");

ALTER TABLE "RegistroWebhook" ADD CONSTRAINT "RegistroWebhook_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
