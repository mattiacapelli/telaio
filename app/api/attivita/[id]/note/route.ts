import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuova = z.object({ testo: z.string().min(1, "la nota è vuota") });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Nuova.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }

  const esiste = await prisma.attivita.findUnique({ where: { id }, select: { id: true } });
  if (!esiste) {
    return NextResponse.json({ errore: "record inesistente" }, { status: 404 });
  }

  const nota = await prisma.notaOperativa.create({
    data: { attivitaId: id, testo: parsed.data.testo, autore: sessione.email },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...nota }, { status: 201 });
}
