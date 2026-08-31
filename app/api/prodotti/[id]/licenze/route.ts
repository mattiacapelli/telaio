import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuova = z.object({
  clienteId: z.string().min(1, "il cliente è obbligatorio"),
  contrattoId: z.string().optional().nullable(),
  pianoId: z.string().optional().nullable(),
  attivataIl: z.string().min(1, "la data di attivazione è obbligatoria"),
  scadeIl: z.string().optional().nullable(),
  canone: z.coerce.number().nonnegative().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id: prodottoId } = await params;
  const parsed = Nuova.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const prodotto = await prisma.prodotto.findUnique({ where: { id: prodottoId }, select: { id: true } });
  if (!prodotto) {
    return NextResponse.json({ errore: "prodotto inesistente" }, { status: 404 });
  }
  const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
  if (!cliente) {
    return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
  }
  if (d.contrattoId) {
    const contratto = await prisma.contratto.findUnique({ where: { id: d.contrattoId }, select: { id: true } });
    if (!contratto) {
      return NextResponse.json({ errore: "contratto inesistente" }, { status: 400 });
    }
  }
  if (d.pianoId) {
    const piano = await prisma.pianoProdotto.findUnique({ where: { id: d.pianoId }, select: { id: true, prodottoId: true } });
    if (!piano || piano.prodottoId !== prodottoId) {
      return NextResponse.json({ errore: "piano inesistente per questo prodotto" }, { status: 400 });
    }
  }

  const licenza = await prisma.licenzaProdotto.create({
    data: {
      prodottoId,
      clienteId: d.clienteId,
      contrattoId: d.contrattoId || null,
      pianoId: d.pianoId || null,
      attivataIl: new Date(`${d.attivataIl}T00:00:00.000Z`),
      scadeIl: d.scadeIl ? new Date(`${d.scadeIl}T00:00:00.000Z`) : null,
      // Con un piano il canone si legge da lì: qui resta nullo per non avere
      // due fonti in disaccordo se il piano cambia prezzo in futuro.
      canone: d.pianoId ? null : d.canone ?? null,
      note: d.note || null,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: licenza.id }, { status: 201 });
}
