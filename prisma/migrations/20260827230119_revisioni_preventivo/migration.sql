-- AlterTable
ALTER TABLE "Preventivo" ADD COLUMN     "revisioneCorrente" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "RevisionePreventivo" (
    "id" TEXT NOT NULL,
    "preventivoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titolo" TEXT NOT NULL,
    "imponibile" DECIMAL(12,2) NOT NULL,
    "scadeIl" TIMESTAMP(3),
    "motivo" TEXT,
    "voci" JSONB NOT NULL,
    "autore" TEXT,
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionePreventivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionePreventivo_preventivoId_idx" ON "RevisionePreventivo"("preventivoId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionePreventivo_preventivoId_numero_key" ON "RevisionePreventivo"("preventivoId", "numero");

-- AddForeignKey
ALTER TABLE "RevisionePreventivo" ADD CONSTRAINT "RevisionePreventivo_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
