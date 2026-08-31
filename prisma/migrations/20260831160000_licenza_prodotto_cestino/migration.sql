-- Il cestino centralizzato (lib/eliminazione.ts) tratta LicenzaProdotto come
-- entità soft-delete: senza questo campo l'eliminazione non è reversibile.

ALTER TABLE "LicenzaProdotto" ADD COLUMN "eliminataIl" TIMESTAMP(3);
CREATE INDEX "LicenzaProdotto_eliminataIl_idx" ON "LicenzaProdotto"("eliminataIl");
