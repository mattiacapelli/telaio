-- Più ragioni sociali configurabili: i dati anagrafici dell'emittente
-- passano da Impostazioni (singleton) ad Azienda (più righe, una predefinita).

CREATE TABLE "Azienda" (
    "id" TEXT NOT NULL,
    "ragioneSociale" TEXT NOT NULL,
    "partitaIva" TEXT,
    "codiceFiscale" TEXT,
    "iban" TEXT,
    "regimeFiscale" TEXT,
    "indirizzo" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "pec" TEXT,
    "sitoWeb" TEXT,
    "logoChiave" TEXT,
    "predefinita" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Azienda_pkey" PRIMARY KEY ("id")
);

-- Porta i dati anagrafici già inseriti dall'utente in Impostazioni su una
-- prima riga di Azienda, invece di farli sparire con la colonna che li
-- conteneva. Se Impostazioni non esiste ancora (installazione nuova) non
-- crea nulla: la prima Azienda la fa il seed o l'utente dalle impostazioni.
INSERT INTO "Azienda" ("id", "ragioneSociale", "partitaIva", "iban", "predefinita", "updatedAt")
SELECT
    'azienda_' || substr(md5(random()::text), 1, 20),
    "ragioneSociale",
    "partitaIva",
    "iban",
    true,
    CURRENT_TIMESTAMP
FROM "Impostazioni"
WHERE id = 1;

ALTER TABLE "Impostazioni" DROP COLUMN "ragioneSociale";
ALTER TABLE "Impostazioni" DROP COLUMN "partitaIva";
ALTER TABLE "Impostazioni" DROP COLUMN "iban";
ALTER TABLE "Impostazioni" ADD COLUMN "sogliaBollo" DECIMAL(10,2) NOT NULL DEFAULT 77.47;
ALTER TABLE "Impostazioni" ADD COLUMN "importoBollo" DECIMAL(10,2) NOT NULL DEFAULT 2;

ALTER TABLE "Preventivo" ADD COLUMN "aziendaId" TEXT;
ALTER TABLE "Contratto" ADD COLUMN "aziendaId" TEXT;
ALTER TABLE "Fattura" ADD COLUMN "aziendaId" TEXT;

ALTER TABLE "Preventivo" ADD CONSTRAINT "Preventivo_aziendaId_fkey"
    FOREIGN KEY ("aziendaId") REFERENCES "Azienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contratto" ADD CONSTRAINT "Contratto_aziendaId_fkey"
    FOREIGN KEY ("aziendaId") REFERENCES "Azienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_aziendaId_fkey"
    FOREIGN KEY ("aziendaId") REFERENCES "Azienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
