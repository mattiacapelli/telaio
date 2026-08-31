import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  // Assente = progetto interno (R&D, prodotto proprio), non fatturato a un cliente.
  clienteId: z.string().optional().nullable(),
  valore: z.coerce.number().min(0).default(0),
  budgetOre: z.coerce.number().min(0).default(0),
  inizioIl: z.string().optional().nullable(),
  consegnaIl: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Nuovo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (d.clienteId) {
    const c = await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
    if (!c) {
      return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
    }
  }

  const progetto = await prisma.progetto.create({
    data: {
      nome: d.nome,
      clienteId: d.clienteId || null,
      valore: d.valore,
      budgetOre: d.budgetOre,
      inizioIl: d.inizioIl ? new Date(`${d.inizioIl}T00:00:00.000Z`) : null,
      consegnaIl: d.consegnaIl ? new Date(`${d.consegnaIl}T00:00:00.000Z`) : null,
      note: d.note || null,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: progetto.id }, { status: 201 });
}
