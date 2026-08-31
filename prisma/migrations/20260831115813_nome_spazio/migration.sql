-- Nome dello spazio di lavoro: separato dalla ragione sociale dell'Azienda
-- predefinita, così sidebar e title restano stabili anche cambiando quale
-- azienda emette i documenti.

ALTER TABLE "Impostazioni" ADD COLUMN "nomeSpazio" TEXT NOT NULL DEFAULT 'Telaio';
ALTER TABLE "Impostazioni" ADD COLUMN "inizialeSpazio" TEXT;

-- Continuità visiva: parte dalla ragione sociale già predefinita, se c'è.
UPDATE "Impostazioni" i
SET "nomeSpazio" = a."ragioneSociale"
FROM "Azienda" a
WHERE a.predefinita = true AND i.id = 1;
