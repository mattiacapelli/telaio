import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const NuovaNota = z.object({ testo: z.string().min(1, "la nota è vuota") });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = NuovaNota.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }

  const progetto = await prisma.progetto.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!progetto) {
    return NextResponse.json({ errore: "progetto inesistente" }, { status: 404 });
  }

  const nota = await prisma.notaProgetto.create({
    data: { progettoId: id, testo: parsed.data.testo, autore: sessione.email },
    select: { id: true },
  });

  // Il testo integrale sta già nella nota: nel diario basta l'inizio.
  await registraEvento(id, "nota", "Nota aggiunta", {
    dettaglio: parsed.data.testo.slice(0, 120),
    autore: sessione.email,
  });
  await invalidate();
  return NextResponse.json({ ok: true, ...nota }, { status: 201 });
}
