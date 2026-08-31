import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { generaPdf } from "@/lib/pdf/generatore";
import type { DatiDocumento } from "@/lib/pdf/generatore";
import { STILE_PREDEFINITO } from "@/lib/pdf/blocchi";
import type { BloccoPdf, StilePdf } from "@/lib/pdf/blocchi";
import { emittenteDocumento } from "@/lib/pdf/emittente";
import { aziendaPerDocumento } from "@/lib/aziende";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Anteprima del modello con dati di esempio.
 *
 * Usa dati inventati invece di un documento reale: il builder deve poter
 * mostrare il risultato anche quando non esiste ancora nessun preventivo.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const [modello, impostazioni] = await Promise.all([
    prisma.modelloPdf.findUnique({ where: { id } }),
    prisma.impostazioni.findUnique({ where: { id: 1 } }),
  ]);
  if (!modello) {
    return NextResponse.json({ errore: "modello inesistente" }, { status: 404 });
  }

  // Il builder invia i blocchi non ancora salvati, così l'anteprima
  // riflette le modifiche in corso.
  const corpo = await req.json().catch(() => null);
  const blocchi = (corpo?.blocchi as BloccoPdf[]) ?? (modello.blocchi as unknown as BloccoPdf[]);
  const stile: StilePdf = {
    ...STILE_PREDEFINITO,
    ...(modello.stile as unknown as Partial<StilePdf>),
    ...(corpo?.stile ?? {}),
  };

  const preventivo = modello.ambito === "PREVENTIVO";
  const azienda = await aziendaPerDocumento();
  const { emittente, bollo } = await emittenteDocumento(azienda, impostazioni);
  const esempio: DatiDocumento = {
    numero: preventivo ? "PRE-2026/000" : "CON-2026/000",
    revisione: preventivo ? "r2" : undefined,
    titolo: preventivo ? "Portale clienti e area riservata" : "Assistenza sistemistica",
    tipo: preventivo ? undefined : "Assistenza a ore",
    emittente,
    bollo,
    cliente: {
      ragioneSociale: "Cliente di esempio S.r.l.",
      partitaIva: "IT 01234567890",
      citta: "Milano",
      referente: "Giulia Rossi",
    },
    dataEmissione: new Date(),
    scadeIl: new Date(Date.now() + 30 * 86400000),
    validitaGiorni: 30,
    testi: {
      premessa:
        "Il presente documento definisce le attività concordate e il relativo corrispettivo. " +
        "Eventuali richieste non comprese saranno quotate a parte.",
      oggetto:
        "Il prestatore si impegna a fornire assistenza tecnica e manutenzione correttiva " +
        "sui sistemi del committente, entro il monte ore concordato.",
      condizioniPagamento:
        "Il corrispettivo è dovuto entro 30 giorni dalla data fattura, mediante bonifico bancario.",
      condizioniServizio:
        "Il servizio è erogato nei giorni lavorativi dalle 9:00 alle 18:00, con presa in carico " +
        "entro 8 ore lavorative dalla segnalazione.",
      tempiConsegna: "I tempi decorrono dall'accettazione e dalla ricezione dei materiali necessari.",
      modalitaPagamento: "Bonifico bancario a 30 giorni data fattura.",
      note: "Documento di esempio, generato per l'anteprima del modello.",
    },
    voci: [
      { descrizione: "Analisi e progettazione", nota: "Incontri con il referente", quantita: 16, unita: "ORE", prezzo: 65, sconto: 0 },
      { descrizione: "Sviluppo dell'area riservata", quantita: 60, unita: "ORE", prezzo: 65, sconto: 10 },
      { descrizione: "Test e rilascio", quantita: 12, unita: "ORE", prezzo: 65, sconto: 0 },
    ],
    riepilogo: {
      scontiRiga: 390,
      scontoTotale: 0,
      imponibile: 5330,
      iva: 1172.6,
      totale: 6502.6,
    },
    scontoPercento: 0,
    aliquotaIva: 22,
    contratto: {
      canone: 900,
      periodicita: "MENSILE",
      monteOre: 20,
      tariffaExtra: 68,
      inizioIl: new Date(),
      scadeIl: new Date(Date.now() + 365 * 86400000),
      rinnovoAutomatico: true,
      preavvisoGiorni: 30,
    },
  };

  const pdf = await generaPdf(esempio, blocchi, stile);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="anteprima.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
