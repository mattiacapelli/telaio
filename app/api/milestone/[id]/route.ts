import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

/** Spunta o riapre una milestone. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const completata = Boolean(body?.completata);

  const m = await prisma.milestone.findUnique({ where: { id } });
  if (!m) {
    return NextResponse.json({ errore: "milestone inesistente" }, { status: 404 });
  }

  await prisma.milestone.update({ where: { id }, data: { completata } });
  await registraEvento(
    m.progettoId,
    "milestone",
    completata ? `Milestone raggiunta: ${m.titolo}` : `Milestone riaperta: ${m.titolo}`,
    { autore: sessione.email },
  );

  await invalidate();
  return NextResponse.json({ ok: true });
}
