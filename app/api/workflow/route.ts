import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Blocco = z.object({
  id: z.string(),
  tipo: z.string(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  pos: z.object({ x: z.number(), y: z.number() }),
});

const Schema = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  descrizione: z.string().optional().nullable(),
  attivo: z.boolean().default(true),
  innesco: z.enum(["EVENTO", "PIANIFICATO", "MANUALE"]).default("EVENTO"),
  eventoChiave: z.string().optional().nullable(),
  blocchi: z.array(Blocco).default([]),
  collegamenti: z.array(z.object({ da: z.string(), a: z.string() })).default([]),
});

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const w = await prisma.workflow.create({
    data: {
      nome: d.nome,
      descrizione: d.descrizione || null,
      attivo: d.attivo,
      innesco: d.innesco,
      eventoChiave: d.eventoChiave || null,
      condizioni: [],
      // Blocchi e collegamenti stanno insieme: il canvas è un unico documento.
      azioni: { blocchi: d.blocchi, collegamenti: d.collegamenti },
    },
    select: { id: true, nome: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...w }, { status: 201 });
}
