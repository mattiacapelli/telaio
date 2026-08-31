-- Progetti interni (non fatturati a un cliente specifico) e catalogo
-- prodotti software, licenziabili a più clienti diversi.

-- Progetto.clienteId diventa facoltativo: un progetto interno (R&D, un
-- prodotto proprio) non ha un cliente da fatturare.
ALTER TABLE "Progetto" DROP CONSTRAINT "Progetto_clienteId_fkey";
ALTER TABLE "Progetto" ALTER COLUMN "clienteId" DROP NOT NULL;
ALTER TABLE "Progetto" ADD CONSTRAINT "Progetto_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Prodotto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "prezzoListino" DECIMAL(10,2),
    "progettoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminataIl" TIMESTAMP(3),

    CONSTRAINT "Prodotto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prodotto_eliminataIl_idx" ON "Prodotto"("eliminataIl");

ALTER TABLE "Prodotto" ADD CONSTRAINT "Prodotto_progettoId_fkey"
    FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "StatoLicenza" AS ENUM ('ATTIVA', 'SOSPESA', 'SCADUTA', 'DISDETTA');

CREATE TABLE "LicenzaProdotto" (
    "id" TEXT NOT NULL,
    "prodottoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contrattoId" TEXT,
    "stato" "StatoLicenza" NOT NULL DEFAULT 'ATTIVA',
    "attivataIl" DATE NOT NULL,
    "scadeIl" DATE,
    "canone" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenzaProdotto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LicenzaProdotto_prodottoId_idx" ON "LicenzaProdotto"("prodottoId");
CREATE INDEX "LicenzaProdotto_clienteId_idx" ON "LicenzaProdotto"("clienteId");
CREATE INDEX "LicenzaProdotto_stato_idx" ON "LicenzaProdotto"("stato");

ALTER TABLE "LicenzaProdotto" ADD CONSTRAINT "LicenzaProdotto_prodottoId_fkey"
    FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenzaProdotto" ADD CONSTRAINT "LicenzaProdotto_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenzaProdotto" ADD CONSTRAINT "LicenzaProdotto_contrattoId_fkey"
    FOREIGN KEY ("contrattoId") REFERENCES "Contratto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
