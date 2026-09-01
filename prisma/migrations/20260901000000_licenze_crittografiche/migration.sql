-- Firma digitale a due livelli per le licenze: una coppia di chiavi
-- "master" per prodotto (la privata cifrata a riposo, mai esposta) certifica
-- la coppia dedicata di ogni singola licenza. La privata di licenza non
-- viene mai salvata: si usa in memoria per firmare e si scarta subito.

CREATE TYPE "ModalitaLicenza" AS ENUM ('NESSUNA', 'ONLINE', 'OFFLINE', 'ENTRAMBE');

ALTER TABLE "Prodotto" ADD COLUMN "modalitaLicenza" "ModalitaLicenza" NOT NULL DEFAULT 'NESSUNA';
ALTER TABLE "Prodotto" ADD COLUMN "chiavePubblicaMaster" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "chiavePrivataMasterCifrata" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "chiaveMasterGenerataIl" TIMESTAMP(3);

ALTER TABLE "LicenzaProdotto" ADD COLUMN "chiavePubblicaLicenza" TEXT;
ALTER TABLE "LicenzaProdotto" ADD COLUMN "certificatoLicenza" TEXT;
ALTER TABLE "LicenzaProdotto" ADD COLUMN "fileLicenzaGeneratoIl" TIMESTAMP(3);
