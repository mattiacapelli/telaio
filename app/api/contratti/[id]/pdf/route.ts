import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { generaPdf } from "@/lib/pdf/generatore";
import { modelloPerDocumento } from "@/lib/pdf/modelli";
import { emittenteDocumento } from "@/lib/pdf/emittente";
import { aziendaPerDocumento } from "@/lib/aziende";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const [c, impostazioni] = await Promise.all([
    prisma.contratto.findUnique({
      where: { id },
      include: {
        cliente: { include: { referenti: { where: { principale: true }, take: 1 } } },
      },
    }),
    prisma.impostazioni.findUnique({ where: { id: 1 } }),
  ]);

  if (!c) {
    return NextResponse.json({ errore: "contratto inesistente" }, { status: 404 });
  }

  const [{ blocchi, stile }, azienda] = await Promise.all([
    modelloPerDocumento("CONTRATTO", c.modelloPdfId),
    aziendaPerDocumento(c.aziendaId),
  ]);
  const { emittente, bollo } = await emittenteDocumento(azienda, impostazioni);

  const pdf = await generaPdf({
    numero: c.numero,
    titolo: c.titolo,
    tipo: c.tipo,
    dataEmissione: c.inizioIl,
    emittente,
    bollo,
    cliente: {
      ragioneSociale: c.cliente.ragioneSociale,
      partitaIva: c.cliente.partitaIva,
      citta: c.cliente.citta,
      referente: c.cliente.referenti[0]
        ? `${c.cliente.referenti[0].nome} ${c.cliente.referenti[0].cognome}`
        : null,
    },
    testi: {
      premessa: c.premessa,
      oggetto: c.oggetto,
      condizioniPagamento: c.condizioniPagamento,
      condizioniServizio: c.condizioniServizio,
      note: c.note,
    },
    contratto: {
      canone: n(c.canone),
      periodicita: c.periodicita,
      monteOre: c.monteOre === null ? null : n(c.monteOre),
      tariffaExtra: c.tariffaExtra === null ? null : n(c.tariffaExtra),
      inizioIl: c.inizioIl,
      scadeIl: c.scadeIl,
      rinnovoAutomatico: c.rinnovoAutomatico,
      preavvisoGiorni: c.preavvisoGiorni,
    },
  }, blocchi, stile);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${c.numero.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
