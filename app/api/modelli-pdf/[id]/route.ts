import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const m = await prisma.modelloPdf.findUnique({ where: { id } });
  if (!m) {
    return NextResponse.json({ errore: "modello inesistente" }, { status: 404 });
  }
  // Senza predefinito i documenti resterebbero senza modello: va prima
  // designato un altro.
  if (m.predefinito) {
    const altri = await prisma.modelloPdf.count({
      where: { ambito: m.ambito, NOT: { id } },
    });
    if (altri > 0) {
      return NextResponse.json(
        { errore: "designa prima un altro modello come predefinito" },
        { status: 409 },
      );
    }
  }

  await prisma.modelloPdf.delete({ where: { id } });
  await invalidate();
  return NextResponse.json({ ok: true });
}
