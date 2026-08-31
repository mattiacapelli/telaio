import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  descrizione: z.string().optional().nullable(),
  prezzoListino: z.coerce.number().nonnegative().optional().nullable(),
  progettoId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Nuovo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const prodotto = await prisma.prodotto.create({
    data: {
      nome: d.nome,
      descrizione: d.descrizione || null,
      prezzoListino: d.prezzoListino ?? null,
      progettoId: d.progettoId || null,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: prodotto.id }, { status: 201 });
}
