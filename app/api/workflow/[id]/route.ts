import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { spostaNelCestino, ErroreEliminazione } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const Blocco = z.object({
  id: z.string(),
  tipo: z.string(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  pos: z.object({ x: z.number(), y: z.number() }),
});

const Schema = z.object({
  nome: z.string().min(1),
  descrizione: z.string().optional().nullable(),
  attivo: z.boolean(),
  innesco: z.enum(["EVENTO", "PIANIFICATO", "MANUALE"]),
  eventoChiave: z.string().optional().nullable(),
  blocchi: z.array(Blocco),
  collegamenti: z.array(z.object({ da: z.string(), a: z.string() })),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const esiste = await prisma.workflow.findUnique({ where: { id }, select: { id: true } });
  if (!esiste) {
    return NextResponse.json({ errore: "workflow inesistente" }, { status: 404 });
  }

  await prisma.workflow.update({
    where: { id },
    data: {
      nome: d.nome,
      descrizione: d.descrizione || null,
      attivo: d.attivo,
      innesco: d.innesco,
      eventoChiave: d.eventoChiave || null,
      azioni: { blocchi: d.blocchi, collegamenti: d.collegamenti },
    },
  });

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
  try {
    await spostaNelCestino("workflow", id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }
  await invalidate();
  return NextResponse.json({ ok: true });
}
