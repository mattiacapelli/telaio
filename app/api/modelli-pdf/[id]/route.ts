import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { spostaNelCestino, ErroreEliminazione } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  nome: z.string().min(1).optional(),
  descrizione: z.string().optional().nullable(),
  predefinito: z.boolean().optional(),
  blocchi: z.array(z.any()).optional(),
  stile: z.record(z.string(), z.any()).optional(),
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

  const attuale = await prisma.modelloPdf.findUnique({ where: { id } });
  if (!attuale) {
    return NextResponse.json({ errore: "modello inesistente" }, { status: 404 });
  }

  const d = parsed.data;
  // Un solo predefinito per ambito: il precedente cede il posto.
  if (d.predefinito) {
    await prisma.modelloPdf.updateMany({
      where: { ambito: attuale.ambito, predefinito: true, NOT: { id } },
      data: { predefinito: false },
    });
  }

  await prisma.modelloPdf.update({ where: { id }, data: d });
  await invalidate();
  return NextResponse.json({ ok: true });
}

/**
 * Sposta il modello nel cestino. Se era il predefinito del suo ambito, ne
 * sceglie subito un altro: essendo reversibile non ha senso bloccare qui
 * come invece si fa per l'eliminazione definitiva.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await spostaNelCestino("modelloPdf", id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
