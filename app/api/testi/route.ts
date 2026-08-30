import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  titolo: z.string().min(1, "il titolo è obbligatorio"),
  testo: z.string().min(1, "il testo è obbligatorio"),
  campo: z.string().min(1),
  ambito: z.enum(["PREVENTIVO", "CONTRATTO", "ENTRAMBI"]).default("ENTRAMBI"),
  predefinito: z.boolean().default(false),
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

  // Un solo predefinito per ambito e campo: il precedente viene sostituito.
  if (d.predefinito) {
    await prisma.testoStandard.updateMany({
      where: { ambito: d.ambito, campo: d.campo, predefinito: true },
      data: { predefinito: false },
    });
  }

  const t = await prisma.testoStandard.create({
    data: d,
    select: { id: true, titolo: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...t }, { status: 201 });
}
