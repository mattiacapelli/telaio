import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  stato: z.enum(["ATTIVA", "SOSPESA", "SCADUTA", "DISDETTA"]).optional(),
  contrattoId: z.string().optional().nullable(),
  scadeIl: z.string().optional().nullable(),
  canone: z.coerce.number().nonnegative().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Aggiorna.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const l = await prisma.licenzaProdotto.findUnique({ where: { id } });
  if (!l) {
    return NextResponse.json({ errore: "licenza inesistente" }, { status: 404 });
  }

  if (d.contrattoId) {
    const contratto = await prisma.contratto.findUnique({ where: { id: d.contrattoId }, select: { id: true } });
    if (!contratto) {
      return NextResponse.json({ errore: "contratto inesistente" }, { status: 400 });
    }
  }

  await prisma.licenzaProdotto.update({
    where: { id },
    data: {
      ...(d.stato !== undefined ? { stato: d.stato } : {}),
      ...(d.contrattoId !== undefined ? { contrattoId: d.contrattoId || null } : {}),
      ...(d.scadeIl !== undefined ? { scadeIl: d.scadeIl ? new Date(`${d.scadeIl}T00:00:00.000Z`) : null } : {}),
      ...(d.canone !== undefined ? { canone: d.canone } : {}),
      ...(d.note !== undefined ? { note: d.note || null } : {}),
    },
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}
