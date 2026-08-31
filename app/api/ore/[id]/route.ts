import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { spostaNelCestino, ErroreEliminazione } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  data: z.string().optional(),
  ore: z.coerce.number().positive().optional(),
  descrizione: z.string().optional().nullable(),
  fatturabile: z.boolean().optional(),
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
    return NextResponse.json({ errore: "dati non validi" }, { status: 400 });
  }

  const r = await prisma.registrazioneOre.findUnique({ where: { id } });
  if (!r) {
    return NextResponse.json({ errore: "registrazione inesistente" }, { status: 404 });
  }
  // Una riga già fatturata non si tocca: cambiarla farebbe divergere la
  // fattura emessa dalle ore che la giustificano.
  if (r.rigaFatturaId) {
    return NextResponse.json(
      { errore: "queste ore sono già state fatturate" },
      { status: 409 },
    );
  }

  const d = parsed.data;
  await prisma.registrazioneOre.update({
    where: { id },
    data: {
      ...(d.data !== undefined ? { data: new Date(`${d.data}T00:00:00.000Z`) } : {}),
      ...(d.ore !== undefined ? { ore: d.ore } : {}),
      ...(d.descrizione !== undefined ? { descrizione: d.descrizione || null } : {}),
      ...(d.fatturabile !== undefined ? { fatturabile: d.fatturabile } : {}),
    },
  });

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
  const r = await prisma.registrazioneOre.findUnique({ where: { id } });
  if (!r) {
    return NextResponse.json({ errore: "registrazione inesistente" }, { status: 404 });
  }
  if (r.rigaFatturaId) {
    return NextResponse.json(
      { errore: "queste ore sono già state fatturate" },
      { status: 409 },
    );
  }

  try {
    await spostaNelCestino("registrazioneOre", id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
