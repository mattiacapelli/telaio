import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { prossimoNumeroFattura } from "@/lib/numerazione";
import { periodoDi, consumoPeriodo, PERIODICITA } from "@/lib/contratti";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Genera la fattura del canone per il periodo corrente.
 *
 * Se il monte ore è stato superato, l'eccedenza finisce in una riga separata:
 * il cliente deve vedere quanto ha consumato oltre il concordato.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const c = await prisma.contratto.findUnique({
    where: { id },
    include: { cliente: true },
  });
  if (!c) {
    return NextResponse.json({ errore: "contratto inesistente" }, { status: 404 });
  }
  if (c.stato !== "ATTIVO") {
    return NextResponse.json(
      { errore: "il contratto non è attivo" },
      { status: 400 },
    );
  }

  const { inizio, fine } = periodoDi(c.inizioIl, c.periodicita);

  // Un periodo si fattura una volta sola.
  const gia = await prisma.periodoContratto.findFirst({
    where: { contrattoId: id, inizioIl: inizio, fatturaId: { not: null } },
  });
  if (gia) {
    return NextResponse.json(
      { errore: "il periodo corrente è già stato fatturato" },
      { status: 409 },
    );
  }

  const consumo = await consumoPeriodo(id);
  const righe: { descrizione: string; quantita: number; prezzo: number; ordine: number }[] = [
    {
      descrizione: `${c.titolo} · canone ${PERIODICITA[c.periodicita].toLowerCase()}`,
      quantita: 1,
      prezzo: n(c.canone),
      ordine: 0,
    },
  ];

  if (consumo && consumo.eccedenza > 0) {
    righe.push({
      descrizione: `Ore eccedenti il monte (${consumo.monteOre} h incluse)`,
      quantita: consumo.eccedenza,
      prezzo: consumo.tariffaExtra,
      ordine: 1,
    });
  }

  const imponibile = righe.reduce((s, r) => s + r.quantita * r.prezzo, 0);

  const fattura = await prisma.$transaction(async (tx) => {
    const f = await tx.fattura.create({
      data: {
        numero: await prossimoNumeroFattura(),
        clienteId: c.clienteId,
        stato: "DA_EMETTERE",
        imponibile,
        scadeIl: new Date(Date.now() + c.cliente.terminiPagamento * 86400000),
        righe: { create: righe },
      },
    });

    // Il periodo registra la fattura: è ciò che impedisce il doppio addebito.
    await tx.periodoContratto.upsert({
      where: { contrattoId_inizioIl: { contrattoId: id, inizioIl: inizio } },
      create: {
        contrattoId: id,
        inizioIl: inizio,
        fineIl: fine,
        monteOre: c.monteOre,
        fatturaId: f.id,
      },
      update: { fatturaId: f.id },
    });

    return f;
  });

  await invalidate();
  return NextResponse.json(
    { ok: true, id: fattura.id, numero: fattura.numero, imponibile },
    { status: 201 },
  );
}
