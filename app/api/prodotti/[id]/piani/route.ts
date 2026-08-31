import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome del piano è obbligatorio"),
  descrizione: z.string().optional().nullable(),
  canone: z.coerce.number().nonnegative(),
  periodicita: z.enum(["MENSILE", "TRIMESTRALE", "SEMESTRALE", "ANNUALE"]).default("MENSILE"),
  terminiPagamento: z.coerce.number().int().nonnegative().default(30),
  monteOre: z.coerce.number().nonnegative().optional().nullable(),
  tariffaExtra: z.coerce.number().nonnegative().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id: prodottoId } = await params;
  const parsed = Nuovo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const prodotto = await prisma.prodotto.findUnique({ where: { id: prodottoId }, select: { id: true } });
  if (!prodotto) {
    return NextResponse.json({ errore: "prodotto inesistente" }, { status: 404 });
  }

  const piano = await prisma.pianoProdotto.create({
    data: {
      prodottoId,
      nome: d.nome,
      descrizione: d.descrizione || null,
      canone: d.canone,
      periodicita: d.periodicita,
      terminiPagamento: d.terminiPagamento,
      monteOre: d.monteOre ?? null,
      tariffaExtra: d.tariffaExtra ?? null,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: piano.id }, { status: 201 });
}
