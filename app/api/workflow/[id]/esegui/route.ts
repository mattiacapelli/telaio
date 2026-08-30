import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { esegui } from "@/lib/workflow/motore";
import type { SchemaWorkflow } from "@/lib/workflow/tipi";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Esecuzione manuale, usata anche come prova dall'editor.
 *
 * Il corpo può contenere un contesto di prova; senza, il workflow gira con un
 * contesto vuoto — utile per verificare che le azioni non falliscano.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const w = await prisma.workflow.findUnique({ where: { id } });
  if (!w) {
    return NextResponse.json({ errore: "workflow inesistente" }, { status: 404 });
  }

  const corpo = await req.json().catch(() => ({}));
  const esito = await esegui(
    w.id,
    (w.azioni as unknown as SchemaWorkflow) ?? { blocchi: [], collegamenti: [] },
    {
      evento: w.eventoChiave ?? "manuale",
      entita: corpo?.entita ?? "nessuna",
      id: corpo?.id,
      dati: corpo?.dati ?? {},
    },
  );

  await invalidate();
  return NextResponse.json(esito);
}
