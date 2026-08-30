import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  stato: z.enum(["DA_FARE", "IN_CORSO", "BLOCCATA", "FATTA"]),
  // Campi modificabili dalla scheda: assenti quando arriva solo la spunta.
  titolo: z.string().min(1).optional(),
  stimaOre: z.coerce.number().nonnegative().optional().nullable(),
  scadenzaIl: z.string().optional().nullable(),
  bloccoNota: z.string().optional().nullable(),
});

/** Cambio stato rapido dalla scheda progetto (spunta e riapertura). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Aggiorna.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "stato non valido" }, { status: 400 });
  }

  const a = await prisma.attivita.findUnique({ where: { id } });
  if (!a) {
    return NextResponse.json({ errore: "attività inesistente" }, { status: 404 });
  }

  const stato = parsed.data.stato;
  const d = parsed.data;
  await prisma.attivita.update({
    where: { id },
    data: {
      stato,
      completataIl: stato === "FATTA" ? new Date() : null,
      ...(d.titolo !== undefined ? { titolo: d.titolo } : {}),
      ...(d.stimaOre !== undefined ? { stimaOre: d.stimaOre } : {}),
      ...(d.scadenzaIl !== undefined
        ? { scadenzaIl: d.scadenzaIl ? new Date(d.scadenzaIl) : null }
        : {}),
      ...(d.bloccoNota !== undefined ? { bloccoNota: d.bloccoNota || null } : {}),
    },
  });

  if (a.progettoId) {
    await registraEvento(
      a.progettoId,
      "attivita",
      stato === "FATTA" ? `Completata: ${a.titolo}` : `${a.titolo} → ${stato.toLowerCase().replace("_", " ")}`,
      { autore: sessione.email },
    );
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
