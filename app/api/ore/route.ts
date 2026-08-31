import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";

export const dynamic = "force-dynamic";

const Nuova = z.object({
  data: z.string().min(1, "la data è obbligatoria"),
  ore: z.coerce.number().positive("le ore devono essere maggiori di zero"),
  descrizione: z.string().optional().nullable(),
  fatturabile: z.boolean().default(true),
  progettoId: z.string().optional().nullable(),
  attivitaId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
});

/**
 * Registrazione manuale delle ore.
 *
 * Serve per il lavoro svolto senza timer: senza questa, l'unico modo di
 * registrare il tempo sarebbe ricordarsi di avviare il cronometro.
 */
export async function POST(req: Request) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Nuova.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Le ore devono appartenere a qualcosa, altrimenti non sono attribuibili
  // né a un progetto né a un cliente.
  if (!d.progettoId && !d.attivitaId && !d.ticketId && !d.clienteId) {
    return NextResponse.json(
      { errore: "indica un progetto, un'attività, un ticket o un cliente" },
      { status: 400 },
    );
  }
  if (d.clienteId) {
    const c = await prisma.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
    if (!c) {
      return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
    }
  }

  // Se arriva un'attività, il progetto si deduce da lei: così le ore
  // compaiono anche nei totali del progetto.
  let progettoId = d.progettoId || null;
  if (d.attivitaId) {
    const a = await prisma.attivita.findUnique({
      where: { id: d.attivitaId },
      select: { progettoId: true },
    });
    if (!a) {
      return NextResponse.json({ errore: "attività inesistente" }, { status: 400 });
    }
    progettoId = progettoId ?? a.progettoId;
  }
  if (d.ticketId) {
    const t = await prisma.ticket.findUnique({
      where: { id: d.ticketId },
      select: { progettoId: true },
    });
    if (!t) {
      return NextResponse.json({ errore: "ticket inesistente" }, { status: 400 });
    }
    progettoId = progettoId ?? t.progettoId;
  }

  const r = await prisma.registrazioneOre.create({
    data: {
      // La data arriva come "2026-08-30": la trattiamo in UTC come le altre
      // date di dominio, per non slittare di un giorno secondo il fuso.
      data: new Date(`${d.data}T00:00:00.000Z`),
      ore: d.ore,
      descrizione: d.descrizione || null,
      fatturabile: d.fatturabile,
      progettoId,
      attivitaId: d.attivitaId || null,
      ticketId: d.ticketId || null,
      clienteId: d.clienteId || null,
    },
    select: { id: true, ore: true },
  });

  if (progettoId) {
    await registraEvento(progettoId, "ore", `${d.ore} h registrate`, {
      dettaglio: d.descrizione || null,
      autore: sessione.email,
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true, ...r }, { status: 201 });
}
