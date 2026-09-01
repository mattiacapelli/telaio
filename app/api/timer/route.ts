import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { arrotondaOre } from "@/lib/format";

export const dynamic = "force-dynamic";

const KEY = "telaio:timer:corrente";

type TimerState = {
  avviatoIl: number; // epoch ms
  attivitaId?: string | null;
  ticketId?: string | null;
  progettoId?: string | null;
  etichetta?: string | null;
};

/**
 * Il timer vive in Redis, non in memoria del processo: sopravvive ai reload di
 * Next in sviluppo e resta coerente fra più istanze dell'app in produzione.
 */
export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  try {
    const raw = await redis.get(KEY);
    if (!raw) return NextResponse.json({ attivo: false, secondi: 0 });

    const s = JSON.parse(raw) as TimerState;
    return NextResponse.json({
      attivo: true,
      secondi: Math.floor((Date.now() - s.avviatoIl) / 1000),
      etichetta: s.etichetta ?? null,
      attivitaId: s.attivitaId ?? null,
      ticketId: s.ticketId ?? null,
    });
  } catch {
    // Redis non raggiungibile: il timer semplicemente non è disponibile.
    return NextResponse.json({ attivo: false, secondi: 0 });
  }
}

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const azione = body?.azione as "start" | "stop" | undefined;

  if (azione === "start") {
    const state: TimerState = {
      avviatoIl: Date.now(),
      attivitaId: body.attivitaId ?? null,
      ticketId: body.ticketId ?? null,
      progettoId: body.progettoId ?? null,
      etichetta: body.etichetta ?? null,
    };
    await redis.set(KEY, JSON.stringify(state));
    return NextResponse.json({ attivo: true, secondi: 0 });
  }

  if (azione === "stop") {
    const raw = await redis.get(KEY);
    if (!raw) return NextResponse.json({ attivo: false, secondi: 0 });

    const s = JSON.parse(raw) as TimerState;
    const secondi = Math.floor((Date.now() - s.avviatoIl) / 1000);
    await redis.del(KEY);

    // Sotto il minuto non vale la pena creare una registrazione.
    if (secondi >= 60) {
      const ore = arrotondaOre(secondi / 3600);
      await prisma.registrazioneOre.create({
        data: {
          data: new Date(),
          ore,
          descrizione: s.etichetta ?? "Timer",
          attivitaId: s.attivitaId ?? null,
          ticketId: s.ticketId ?? null,
          progettoId: s.progettoId ?? null,
        },
      });
      return NextResponse.json({ attivo: false, secondi, registrata: ore });
    }

    return NextResponse.json({ attivo: false, secondi, registrata: 0 });
  }

  return NextResponse.json({ errore: "azione non valida" }, { status: 400 });
}
