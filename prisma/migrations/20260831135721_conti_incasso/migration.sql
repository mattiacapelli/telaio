-- Anagrafica dei conti su cui arrivano gli incassi, al posto del campo di
-- testo libero: un'unica battitura sbagliata non spacca più lo stesso conto
-- in due nei riepiloghi.

CREATE TABLE "ContoIncasso" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "note" TEXT,
    "predefinito" BOOLEAN NOT NULL DEFAULT false,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminataIl" TIMESTAMP(3),

    CONSTRAINT "ContoIncasso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContoIncasso_eliminataIl_idx" ON "ContoIncasso"("eliminataIl");

ALTER TABLE "Incasso" ADD COLUMN "contoId" TEXT;
CREATE INDEX "Incasso_contoId_idx" ON "Incasso"("contoId");

-- Ogni valore distinto già scritto nel vecchio campo "conto" diventa un
-- ContoIncasso vero, e gli incassi che lo usavano vengono ricollegati.
INSERT INTO "ContoIncasso" ("id", "nome", "predefinito", "updatedAt")
SELECT
    'conto_' || substr(md5(conto), 1, 20),
    conto,
    (row_number() OVER (ORDER BY MIN("createdAt")) = 1),
    CURRENT_TIMESTAMP
FROM "Incasso"
WHERE conto IS NOT NULL AND conto <> ''
GROUP BY conto;

UPDATE "Incasso" i
SET "contoId" = c.id
FROM "ContoIncasso" c
WHERE i.conto = c.nome;

ALTER TABLE "Incasso" ADD CONSTRAINT "Incasso_contoId_fkey"
    FOREIGN KEY ("contoId") REFERENCES "ContoIncasso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incasso" DROP COLUMN "conto";
