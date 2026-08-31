import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  clienteId: z.string().min(1, "il cliente è obbligatorio"),
  titolo: z.string().min(1, "il titolo è obbligatorio"),
  descrizione: z.string().optional().nullable(),
  progettoId: z.string().optional().nullable(),
  priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
});

export async function POST(req: Request) {
  const sessione = await leggiSessione();
  if (!sessione) {
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

  const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
  if (!cliente) {
    return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
  }

  // Il numero è progressivo su tutti i ticket, non per cliente: così
  // "#128" identifica il ticket senza ambiguità in qualunque contesto.
  const ultimo = await prisma.ticket.findFirst({ orderBy: { numero: "desc" } });
  const ticket = await prisma.ticket.create({
    data: {
      numero: (ultimo?.numero ?? 0) + 1,
      clienteId: d.clienteId,
      titolo: d.titolo,
      descrizione: d.descrizione || null,
      progettoId: d.progettoId || null,
      priorita: d.priorita,
    },
    select: { id: true, numero: true, progettoId: true },
  });

  if (ticket.progettoId) {
    await registraEvento(ticket.progettoId, "problema", `Ticket #${ticket.numero} aperto`, {
      dettaglio: d.titolo,
      autore: sessione.email,
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true, id: ticket.id, numero: ticket.numero }, { status: 201 });
}
