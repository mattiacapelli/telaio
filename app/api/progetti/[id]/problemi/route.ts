import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  titolo: z.string().min(1, "il titolo è obbligatorio"),
  descrizione: z.string().optional().nullable(),
  gravita: z.enum(["BASSA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  impattoOre: z.coerce.number().nonnegative().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Nuovo.safeParse(await req.json().catch(() => null));
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

  const p = await prisma.problema.create({
    data: {
      progettoId: id,
      titolo: parsed.data.titolo,
      descrizione: parsed.data.descrizione || null,
      gravita: parsed.data.gravita,
      impattoOre: parsed.data.impattoOre ?? null,
      segnalatoDa: sessione.email,
    },
    select: { id: true, titolo: true, gravita: true },
  });

  await registraEvento(id, "problema", `Criticità aperta: ${p.titolo}`, {
    dettaglio: `gravità ${p.gravita.toLowerCase()}`,
    autore: sessione.email,
  });
  await invalidate();
  return NextResponse.json({ ok: true, ...p }, { status: 201 });
}
