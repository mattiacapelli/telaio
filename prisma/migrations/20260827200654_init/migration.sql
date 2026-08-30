-- CreateEnum
CREATE TYPE "StatoPreventivo" AS ENUM ('BOZZA', 'INVIATO', 'ACCETTATO', 'RIFIUTATO');

-- CreateEnum
CREATE TYPE "StatoProgetto" AS ENUM ('DA_AVVIARE', 'IN_CORSO', 'IN_PAUSA', 'CONCLUSO');

-- CreateEnum
CREATE TYPE "StatoAttivita" AS ENUM ('DA_FARE', 'IN_CORSO', 'BLOCCATA', 'FATTA');

-- CreateEnum
CREATE TYPE "StatoTicket" AS ENUM ('APERTO', 'IN_LAVORAZIONE', 'ATTESA_CLIENTE', 'RISOLTO', 'CHIUSO');

-- CreateEnum
CREATE TYPE "PrioritaTicket" AS ENUM ('BASSA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatoFattura" AS ENUM ('DA_EMETTERE', 'EMESSA', 'PAGATA', 'SCADUTA');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('BONIFICO', 'CARTA', 'CONTANTI', 'ALTRO');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "twentyId" TEXT,
    "ragioneSociale" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "settore" TEXT,
    "citta" TEXT,
    "partitaIva" TEXT,
    "codiceFiscale" TEXT,
    "pec" TEXT,
    "codiceSdi" TEXT,
    "tariffaOraria" DECIMAL(10,2) NOT NULL,
    "terminiPagamento" INTEGER NOT NULL DEFAULT 30,
    "statoRelazione" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referente" (
    "id" TEXT NOT NULL,
    "twentyId" TEXT,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "ruolo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "principale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Referente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preventivo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "stato" "StatoPreventivo" NOT NULL DEFAULT 'BOZZA',
    "imponibile" DECIMAL(12,2) NOT NULL,
    "inviatoIl" TIMESTAMP(3),
    "scadeIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preventivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocePreventivo" (
    "id" TEXT NOT NULL,
    "preventivoId" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "quantita" DECIMAL(10,2) NOT NULL,
    "unita" TEXT NOT NULL DEFAULT 'h',
    "prezzo" DECIMAL(10,2) NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VocePreventivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progetto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "preventivoId" TEXT,
    "stato" "StatoProgetto" NOT NULL DEFAULT 'DA_AVVIARE',
    "valore" DECIMAL(12,2) NOT NULL,
    "budgetOre" DECIMAL(10,2) NOT NULL,
    "inizioIl" TIMESTAMP(3),
    "consegnaIl" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progetto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "progettoId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "scadenzaIl" TIMESTAMP(3),
    "completata" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attivita" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "progettoId" TEXT,
    "stato" "StatoAttivita" NOT NULL DEFAULT 'DA_FARE',
    "stimaOre" DECIMAL(10,2),
    "scadenzaIl" TIMESTAMP(3),
    "bloccoNota" TEXT,
    "completataIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attivita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT,
    "clienteId" TEXT NOT NULL,
    "progettoId" TEXT,
    "stato" "StatoTicket" NOT NULL DEFAULT 'APERTO',
    "priorita" "PrioritaTicket" NOT NULL DEFAULT 'MEDIA',
    "conContratto" BOOLEAN NOT NULL DEFAULT false,
    "apertoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risoltoIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrazioneOre" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "ore" DECIMAL(6,2) NOT NULL,
    "descrizione" TEXT,
    "fatturabile" BOOLEAN NOT NULL DEFAULT true,
    "progettoId" TEXT,
    "attivitaId" TEXT,
    "ticketId" TEXT,
    "rigaFatturaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrazioneOre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fattura" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "stato" "StatoFattura" NOT NULL DEFAULT 'DA_EMETTERE',
    "imponibile" DECIMAL(12,2) NOT NULL,
    "aliquotaIva" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "emessaIl" TIMESTAMP(3),
    "scadeIl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fattura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RigaFattura" (
    "id" TEXT NOT NULL,
    "fatturaId" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "quantita" DECIMAL(10,2) NOT NULL,
    "prezzo" DECIMAL(10,2) NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RigaFattura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incasso" (
    "id" TEXT NOT NULL,
    "fatturaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "importo" DECIMAL(12,2) NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL DEFAULT 'BONIFICO',
    "conto" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incasso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impostazioni" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ragioneSociale" TEXT NOT NULL DEFAULT 'Marco Ferrero',
    "partitaIva" TEXT,
    "iban" TEXT,
    "tariffaListino" DECIMAL(10,2) NOT NULL DEFAULT 65,
    "terminiPagamento" INTEGER NOT NULL DEFAULT 30,
    "twentyWorkspace" TEXT,
    "twentySyncedAt" TIMESTAMP(3),
    "twentyFrequenza" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Impostazioni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_twentyId_key" ON "Cliente"("twentyId");

-- CreateIndex
CREATE INDEX "Cliente_ragioneSociale_idx" ON "Cliente"("ragioneSociale");

-- CreateIndex
CREATE UNIQUE INDEX "Referente_twentyId_key" ON "Referente"("twentyId");

-- CreateIndex
CREATE INDEX "Referente_clienteId_idx" ON "Referente"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Preventivo_numero_key" ON "Preventivo"("numero");

-- CreateIndex
CREATE INDEX "Preventivo_stato_idx" ON "Preventivo"("stato");

-- CreateIndex
CREATE INDEX "VocePreventivo_preventivoId_idx" ON "VocePreventivo"("preventivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Progetto_preventivoId_key" ON "Progetto"("preventivoId");

-- CreateIndex
CREATE INDEX "Progetto_stato_idx" ON "Progetto"("stato");

-- CreateIndex
CREATE INDEX "Milestone_progettoId_idx" ON "Milestone"("progettoId");

-- CreateIndex
CREATE INDEX "Attivita_stato_idx" ON "Attivita"("stato");

-- CreateIndex
CREATE INDEX "Attivita_progettoId_idx" ON "Attivita"("progettoId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_numero_key" ON "Ticket"("numero");

-- CreateIndex
CREATE INDEX "Ticket_stato_idx" ON "Ticket"("stato");

-- CreateIndex
CREATE INDEX "RegistrazioneOre_data_idx" ON "RegistrazioneOre"("data");

-- CreateIndex
CREATE INDEX "RegistrazioneOre_progettoId_idx" ON "RegistrazioneOre"("progettoId");

-- CreateIndex
CREATE UNIQUE INDEX "Fattura_numero_key" ON "Fattura"("numero");

-- CreateIndex
CREATE INDEX "Fattura_stato_idx" ON "Fattura"("stato");

-- CreateIndex
CREATE INDEX "RigaFattura_fatturaId_idx" ON "RigaFattura"("fatturaId");

-- CreateIndex
CREATE INDEX "Incasso_data_idx" ON "Incasso"("data");

-- AddForeignKey
ALTER TABLE "Referente" ADD CONSTRAINT "Referente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preventivo" ADD CONSTRAINT "Preventivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocePreventivo" ADD CONSTRAINT "VocePreventivo_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progetto" ADD CONSTRAINT "Progetto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progetto" ADD CONSTRAINT "Progetto_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrazioneOre" ADD CONSTRAINT "RegistrazioneOre_progettoId_fkey" FOREIGN KEY ("progettoId") REFERENCES "Progetto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrazioneOre" ADD CONSTRAINT "RegistrazioneOre_attivitaId_fkey" FOREIGN KEY ("attivitaId") REFERENCES "Attivita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrazioneOre" ADD CONSTRAINT "RegistrazioneOre_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrazioneOre" ADD CONSTRAINT "RegistrazioneOre_rigaFatturaId_fkey" FOREIGN KEY ("rigaFatturaId") REFERENCES "RigaFattura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaFattura" ADD CONSTRAINT "RigaFattura_fatturaId_fkey" FOREIGN KEY ("fatturaId") REFERENCES "Fattura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incasso" ADD CONSTRAINT "Incasso_fatturaId_fkey" FOREIGN KEY ("fatturaId") REFERENCES "Fattura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
