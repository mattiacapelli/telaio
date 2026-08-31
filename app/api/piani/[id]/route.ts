import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  nome: z.string().min(1).optional(),
  descrizione: z.string().optional().nullable(),
  canone: z.coerce.number().nonnegative().optional(),
  periodicita: z.enum(["MENSILE", "TRIMESTRALE", "SEMESTRALE", "ANNUALE"]).optional(),
  terminiPagamento: z.coerce.number().int().nonnegative().optional(),
  monteOre: z.coerce.number().nonnegative().optional().nullable(),
  tariffaExtra: z.coerce.number().nonnegative().optional().nullable(),
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

  const p = await prisma.pianoProdotto.findUnique({ where: { id } });
  if (!p) {
    return NextResponse.json({ errore: "piano inesistente" }, { status: 404 });
  }

  await prisma.pianoProdotto.update({
    where: { id },
    data: {
      ...(d.nome !== undefined ? { nome: d.nome } : {}),
      ...(d.descrizione !== undefined ? { descrizione: d.descrizione || null } : {}),
      ...(d.canone !== undefined ? { canone: d.canone } : {}),
      ...(d.periodicita !== undefined ? { periodicita: d.periodicita } : {}),
      ...(d.terminiPagamento !== undefined ? { terminiPagamento: d.terminiPagamento } : {}),
      ...(d.monteOre !== undefined ? { monteOre: d.monteOre } : {}),
      ...(d.tariffaExtra !== undefined ? { tariffaExtra: d.tariffaExtra } : {}),
    },
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}
