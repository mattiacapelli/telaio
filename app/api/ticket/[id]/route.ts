import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  titolo: z.string().min(1).optional(),
  descrizione: z.string().optional().nullable(),
  stato: z.enum(["APERTO", "IN_LAVORAZIONE", "ATTESA_CLIENTE", "RISOLTO", "CHIUSO"]).optional(),
  priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  conContratto: z.boolean().optional(),
});

const CHIUSI = ["RISOLTO", "CHIUSO"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
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

  const t = await prisma.ticket.findUnique({ where: { id } });
  if (!t) {
    return NextResponse.json({ errore: "ticket inesistente" }, { status: 404 });
  }

  const chiuso = d.stato ? CHIUSI.includes(d.stato) : null;

  await prisma.ticket.update({
    where: { id },
    data: {
      ...(d.titolo !== undefined ? { titolo: d.titolo } : {}),
      ...(d.descrizione !== undefined ? { descrizione: d.descrizione || null } : {}),
      ...(d.priorita !== undefined ? { priorita: d.priorita } : {}),
      ...(d.conContratto !== undefined ? { conContratto: d.conContratto } : {}),
      ...(d.stato !== undefined
        ? { stato: d.stato, risoltoIl: chiuso ? new Date() : null }
        : {}),
    },
  });

  // Se il ticket è legato a un progetto, il cambio di stato finisce nel suo diario.
  if (t.progettoId && d.stato && d.stato !== t.stato) {
    await registraEvento(
      t.progettoId,
      "problema",
      `Ticket #${t.numero} → ${d.stato.toLowerCase().replace("_", " ")}`,
      { autore: sessione.email },
    );
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
