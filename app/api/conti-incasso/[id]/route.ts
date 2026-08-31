import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  nome: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  predefinito: z.boolean().optional(),
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

  const attuale = await prisma.contoIncasso.findUnique({ where: { id } });
  if (!attuale) {
    return NextResponse.json({ errore: "conto inesistente" }, { status: 404 });
  }

  const d = parsed.data;
  // Un solo predefinito in tutto lo studio: il precedente cede il posto.
  if (d.predefinito) {
    await prisma.contoIncasso.updateMany({
      where: { predefinito: true, NOT: { id } },
      data: { predefinito: false },
    });
  }

  await prisma.contoIncasso.update({ where: { id }, data: d });
  await invalidate();
  return NextResponse.json({ ok: true });
}
