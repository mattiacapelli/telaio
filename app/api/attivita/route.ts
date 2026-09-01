import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Nuova = z.object({
  titolo: z.string().min(1, "il titolo è obbligatorio"),
  progettoId: z.string().optional().nullable(),
  stimaOre: z.coerce.number().nonnegative().optional().nullable(),
  scadenzaIl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Nuova.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (d.progettoId) {
    const progetto = await prisma.progetto.findUnique({ where: { id: d.progettoId }, select: { id: true } });
    if (!progetto) {
      return NextResponse.json({ errore: "progetto inesistente" }, { status: 404 });
    }
  }

  const a = await prisma.attivita.create({
    data: {
      progettoId: d.progettoId || null,
      titolo: d.titolo,
      stimaOre: d.stimaOre ?? null,
      scadenzaIl: d.scadenzaIl ? new Date(d.scadenzaIl) : null,
    },
    select: { id: true, titolo: true },
  });

  // Un'attività libera non ha un progetto a cui agganciare l'evento nel diario.
  if (d.progettoId) {
    await registraEvento(d.progettoId, "attivita", `Nuova attività: ${a.titolo}`, {
      autore: sessione.email,
    });
  }
  await invalidate();
  return NextResponse.json({ ok: true, ...a }, { status: 201 });
}
