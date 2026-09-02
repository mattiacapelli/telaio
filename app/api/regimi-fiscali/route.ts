import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  coefficienteRedditivita: z.coerce.number().min(0).max(100),
  aliquotaSostitutiva: z.coerce.number().min(0).max(100),
  aliquotaInps: z.coerce.number().min(0).max(100),
  minimaleInps: z.coerce.number().nonnegative().optional().nullable(),
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

  const esistenti = await prisma.regimeFiscale.count({ where: { eliminataIl: null } });

  const regime = await prisma.regimeFiscale.create({
    data: {
      nome: d.nome,
      coefficienteRedditivita: d.coefficienteRedditivita,
      aliquotaSostitutiva: d.aliquotaSostitutiva,
      aliquotaInps: d.aliquotaInps,
      minimaleInps: d.minimaleInps ?? null,
      // Il primo regime configurato diventa il predefinito: altrimenti
      // nessuna azienda lo userebbe finché non lo si sceglie a mano.
      predefinito: esistenti === 0,
    },
    select: { id: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, id: regime.id }, { status: 201 });
}
