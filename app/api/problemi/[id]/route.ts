import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  stato: z.enum(["APERTO", "IN_GESTIONE", "RISOLTO", "ACCETTATO"]),
  risoluzione: z.string().optional().nullable(),
});

const CHIUSI = ["RISOLTO", "ACCETTATO"];

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

  const p = await prisma.problema.findUnique({ where: { id } });
  if (!p) {
    return NextResponse.json({ errore: "criticità inesistente" }, { status: 404 });
  }

  const { stato, risoluzione } = parsed.data;
  const chiuso = CHIUSI.includes(stato);

  await prisma.problema.update({
    where: { id },
    data: {
      stato,
      risoluzione: risoluzione || p.risoluzione,
      // Riaprendo, la data di chiusura torna vuota.
      risoltoIl: chiuso ? new Date() : null,
    },
  });

  await registraEvento(
    p.progettoId,
    "problema",
    chiuso ? `Criticità chiusa: ${p.titolo}` : `${p.titolo} → ${stato.toLowerCase().replace("_", " ")}`,
    { dettaglio: risoluzione || null, autore: sessione.email },
  );

  await invalidate();
  return NextResponse.json({ ok: true });
}
