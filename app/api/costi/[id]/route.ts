import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { spostaNelCestino, ErroreEliminazione } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  descrizione: z.string().min(1).optional(),
  importo: z.coerce.number().positive().optional(),
  rimborsabile: z.boolean().optional(),
  data: z.string().optional(),
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

  const c = await prisma.costo.findUnique({ where: { id } });
  if (!c) {
    return NextResponse.json({ errore: "costo inesistente" }, { status: 404 });
  }
  // Come per le ore: un costo già fatturato non si modifica, altrimenti la
  // fattura emessa divergerebbe da ciò che la giustifica.
  if (c.rigaFatturaId) {
    return NextResponse.json(
      { errore: "questo costo è già stato fatturato" },
      { status: 409 },
    );
  }

  const d = parsed.data;
  await prisma.costo.update({
    where: { id },
    data: {
      ...(d.descrizione !== undefined ? { descrizione: d.descrizione } : {}),
      ...(d.importo !== undefined ? { importo: d.importo } : {}),
      ...(d.rimborsabile !== undefined ? { rimborsabile: d.rimborsabile } : {}),
      ...(d.data !== undefined ? { data: new Date(`${d.data}T00:00:00.000Z`) } : {}),
    },
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}

/** Sposta il costo nel cestino. L'eliminazione definitiva si fa da lì. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const c = await prisma.costo.findUnique({ where: { id } });
  if (!c) {
    return NextResponse.json({ errore: "costo inesistente" }, { status: 404 });
  }
  if (c.rigaFatturaId) {
    return NextResponse.json(
      { errore: "questo costo è già stato fatturato" },
      { status: 409 },
    );
  }

  try {
    await spostaNelCestino("costo", id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
