import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { modelloPredefinito, STILE_PREDEFINITO } from "@/lib/pdf/blocchi";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  ambito: z.enum(["PREVENTIVO", "CONTRATTO"]),
  descrizione: z.string().optional().nullable(),
  /** Se omesso, il modello parte dai blocchi di base dell'ambito. */
  blocchi: z.array(z.any()).optional(),
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

  const esistenti = await prisma.modelloPdf.count({ where: { ambito: d.ambito } });

  const m = await prisma.modelloPdf.create({
    data: {
      nome: d.nome,
      ambito: d.ambito,
      descrizione: d.descrizione || null,
      // Il primo modello di un ambito diventa il predefinito: altrimenti
      // nessun documento lo userebbe finché non lo si sceglie a mano.
      predefinito: esistenti === 0,
      blocchi: d.blocchi ?? modelloPredefinito(d.ambito),
      stile: STILE_PREDEFINITO,
    },
    select: { id: true, nome: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...m }, { status: 201 });
}
