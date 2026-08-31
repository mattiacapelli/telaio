import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuova = z.object({
  ragioneSociale: z.string().min(1, "la ragione sociale è obbligatoria"),
  partitaIva: z.string().optional().nullable(),
  codiceFiscale: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  regimeFiscale: z.string().optional().nullable(),
  indirizzo: z.string().optional().nullable(),
  citta: z.string().optional().nullable(),
  cap: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  pec: z.string().optional().nullable(),
  sitoWeb: z.string().optional().nullable(),
});

export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  const aziende = await prisma.azienda.findMany({ orderBy: [{ predefinita: "desc" }, { ragioneSociale: "asc" }] });
  return NextResponse.json(aziende);
}

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Nuova.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }

  const esistenti = await prisma.azienda.count();

  const a = await prisma.azienda.create({
    data: {
      ...parsed.data,
      // La prima azienda configurata diventa la predefinita: altrimenti
      // nessun documento avrebbe un emittente finché non la si sceglie a mano.
      predefinita: esistenti === 0,
    },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: a.id }, { status: 201 });
}
