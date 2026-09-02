import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { eliminaFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  ragioneSociale: z.string().min(1).optional(),
  partitaIva: z.string().optional().nullable(),
  codiceFiscale: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  regimeFiscale: z.string().optional().nullable(),
  regimeFiscaleId: z.string().optional().nullable(),
  indirizzo: z.string().optional().nullable(),
  citta: z.string().optional().nullable(),
  cap: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  pec: z.string().optional().nullable(),
  sitoWeb: z.string().optional().nullable(),
  predefinita: z.boolean().optional(),
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

  const attuale = await prisma.azienda.findUnique({ where: { id } });
  if (!attuale) {
    return NextResponse.json({ errore: "azienda inesistente" }, { status: 404 });
  }

  const d = parsed.data;
  // Una sola predefinita in tutto lo studio: le altre cedono il posto.
  if (d.predefinita) {
    await prisma.azienda.updateMany({
      where: { predefinita: true, NOT: { id } },
      data: { predefinita: false },
    });
  }

  await prisma.azienda.update({ where: { id }, data: d });
  await invalidate();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const a = await prisma.azienda.findUnique({ where: { id } });
  if (!a) {
    return NextResponse.json({ errore: "azienda inesistente" }, { status: 404 });
  }

  // Senza predefinita i documenti resterebbero senza un emittente di
  // default: va prima designata un'altra, se ce n'è una.
  if (a.predefinita) {
    const altre = await prisma.azienda.count({ where: { NOT: { id } } });
    if (altre > 0) {
      return NextResponse.json(
        { errore: "designa prima un'altra azienda come predefinita" },
        { status: 409 },
      );
    }
  }

  await prisma.azienda.delete({ where: { id } });
  if (a.logoChiave) await eliminaFile(a.logoChiave).catch(() => {});

  await invalidate();
  return NextResponse.json({ ok: true });
}
