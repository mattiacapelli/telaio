-- Un prodotto può avere più piani (es. Base/Pro), ognuno con il proprio
-- prezzo, periodicità, termini di pagamento e monte ore incluso. Una
-- licenza sceglie un piano invece di avere condizioni libere.

CREATE TABLE "PianoProdotto" (
    "id" TEXT NOT NULL,
    "prodottoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "canone" DECIMAL(10,2) NOT NULL,
    "periodicita" "PeriodicitaContratto" NOT NULL DEFAULT 'MENSILE',
    "terminiPagamento" INTEGER NOT NULL DEFAULT 30,
    "monteOre" DECIMAL(10,2),
    "tariffaExtra" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminataIl" TIMESTAMP(3),

    CONSTRAINT "PianoProdotto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PianoProdotto_prodottoId_idx" ON "PianoProdotto"("prodottoId");
CREATE INDEX "PianoProdotto_eliminataIl_idx" ON "PianoProdotto"("eliminataIl");

ALTER TABLE "PianoProdotto" ADD CONSTRAINT "PianoProdotto_prodottoId_fkey"
    FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LicenzaProdotto" ADD COLUMN "pianoId" TEXT;
CREATE INDEX "LicenzaProdotto_pianoId_idx" ON "LicenzaProdotto"("pianoId");
ALTER TABLE "LicenzaProdotto" ADD CONSTRAINT "LicenzaProdotto_pianoId_fkey"
    FOREIGN KEY ("pianoId") REFERENCES "PianoProdotto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
