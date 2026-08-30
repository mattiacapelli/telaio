import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  titolo: z.string().min(1).optional(),
  testo: z.string().min(1).optional(),
  campo: z.string().min(1).optional(),
  ambito: z.enum(["PREVENTIVO", "CONTRATTO", "ENTRAMBI"]).optional(),
  predefinito: z.boolean().optional(),
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

  const attuale = await prisma.testoStandard.findUnique({ where: { id } });
  if (!attuale) {
    return NextResponse.json({ errore: "testo inesistente" }, { status: 404 });
  }

  const d = parsed.data;
  if (d.predefinito) {
    await prisma.testoStandard.updateMany({
      where: {
        ambito: d.ambito ?? attuale.ambito,
        campo: d.campo ?? attuale.campo,
        predefinito: true,
        NOT: { id },
      },
      data: { predefinito: false },
    });
  }

  await prisma.testoStandard.update({ where: { id }, data: d });
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
  await prisma.testoStandard.delete({ where: { id } }).catch(() => null);
  await invalidate();
  return NextResponse.json({ ok: true });
}
