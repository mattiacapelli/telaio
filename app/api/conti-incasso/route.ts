import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
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

  const esistenti = await prisma.contoIncasso.count({ where: { eliminataIl: null } });

  const conto = await prisma.contoIncasso.create({
    data: {
      nome: d.nome,
      note: d.note || null,
      // Il primo conto configurato diventa il predefinito: altrimenti nessun
      // incasso lo proporrebbe finché non lo si sceglie a mano ogni volta.
      predefinito: esistenti === 0,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: conto.id }, { status: 201 });
}
