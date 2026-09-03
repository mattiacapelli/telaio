import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { contrattoAttivoPer } from "@/lib/contratti";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  titolo: z.string().min(1).optional(),
  stato: z.enum(["BOZZA", "ATTIVO", "SOSPESO", "SCADUTO", "DISDETTO"]).optional(),
  canone: z.coerce.number().nonnegative().optional(),
  monteOre: z.coerce.number().nonnegative().optional().nullable(),
  tariffaExtra: z.coerce.number().nonnegative().optional().nullable(),
  scadeIl: z.string().optional().nullable(),
  rinnovoAutomatico: z.boolean().optional(),
  preavvisoGiorni: z.coerce.number().int().nonnegative().optional(),
  giornoFatturazione: z.coerce.number().int().min(1).max(28).optional().nullable(),
  note: z.string().optional().nullable(),
  premessa: z.string().optional().nullable(),
  oggetto: z.string().optional().nullable(),
  condizioniPagamento: z.string().optional().nullable(),
  condizioniServizio: z.string().optional().nullable(),
  prodottiIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Modifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const c = await prisma.contratto.findUnique({ where: { id } });
  if (!c) {
    return NextResponse.json({ errore: "contratto inesistente" }, { status: 404 });
  }

  if (d.prodottiIds) {
    const trovati = await prisma.prodotto.count({ where: { id: { in: d.prodottiIds } } });
    if (trovati !== d.prodottiIds.length) {
      return NextResponse.json({ errore: "uno o più prodotti non esistono" }, { status: 400 });
    }
  }

  await prisma.contratto.update({
    where: { id },
    data: {
      ...(d.titolo !== undefined ? { titolo: d.titolo } : {}),
      ...(d.stato !== undefined ? { stato: d.stato } : {}),
      ...(d.canone !== undefined ? { canone: d.canone } : {}),
      ...(d.monteOre !== undefined ? { monteOre: d.monteOre } : {}),
      ...(d.tariffaExtra !== undefined ? { tariffaExtra: d.tariffaExtra } : {}),
      ...(d.scadeIl !== undefined
        ? { scadeIl: d.scadeIl ? new Date(d.scadeIl) : null }
        : {}),
      ...(d.rinnovoAutomatico !== undefined
        ? { rinnovoAutomatico: d.rinnovoAutomatico }
        : {}),
      ...(d.preavvisoGiorni !== undefined ? { preavvisoGiorni: d.preavvisoGiorni } : {}),
      ...(d.giornoFatturazione !== undefined ? { giornoFatturazione: d.giornoFatturazione } : {}),
      ...(d.note !== undefined ? { note: d.note || null } : {}),
      ...(d.premessa !== undefined ? { premessa: d.premessa || null } : {}),
      ...(d.oggetto !== undefined ? { oggetto: d.oggetto || null } : {}),
      ...(d.condizioniPagamento !== undefined
        ? { condizioniPagamento: d.condizioniPagamento || null }
        : {}),
      ...(d.condizioniServizio !== undefined
        ? { condizioniServizio: d.condizioniServizio || null }
        : {}),
    },
  });

  // Sincronizza i prodotti collegati: chi entra ottiene una licenza (o si
  // ricollega a una già esistente per lo stesso cliente), chi esce si
  // scollega dal contratto senza perdere la licenza né il suo storico.
  if (d.prodottiIds) {
    const attuali = await prisma.licenzaProdotto.findMany({
      where: { contrattoId: id, eliminataIl: null },
      select: { id: true, prodottoId: true },
    });
    const daRimuovere = attuali.filter((l) => !d.prodottiIds!.includes(l.prodottoId));
    const idProdottiAttuali = new Set(attuali.map((l) => l.prodottoId));
    const daAggiungere = d.prodottiIds.filter((p) => !idProdottiAttuali.has(p));

    if (daRimuovere.length > 0) {
      await prisma.licenzaProdotto.updateMany({
        where: { id: { in: daRimuovere.map((l) => l.id) } },
        data: { contrattoId: null },
      });
    }
    for (const prodottoId of daAggiungere) {
      const esistente = await prisma.licenzaProdotto.findFirst({
        where: { prodottoId, clienteId: c.clienteId, eliminataIl: null },
      });
      if (esistente) {
        await prisma.licenzaProdotto.update({
          where: { id: esistente.id },
          data: { contrattoId: id },
        });
      } else {
        await prisma.licenzaProdotto.create({
          data: { prodottoId, clienteId: c.clienteId, contrattoId: id, attivataIl: new Date() },
        });
      }
    }
  }

  // Attivando un contratto di assistenza, i ticket aperti del cliente non
  // ancora coperti gli vengono collegati: senza, il monte ore resterebbe
  // fermo mentre il lavoro è già in corso.
  if (d.stato === "ATTIVO" && c.tipo === "ASSISTENZA_ORE") {
    await prisma.ticket.updateMany({
      where: {
        clienteId: c.clienteId,
        contrattoId: null,
        stato: { notIn: ["RISOLTO", "CHIUSO"] },
      },
      data: { contrattoId: id, conContratto: true },
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.contratto.delete({ where: { id } }).catch(() => null);
  await invalidate();
  return NextResponse.json({ ok: true });
}
