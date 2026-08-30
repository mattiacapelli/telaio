import { NextResponse } from "next/server";
import { z } from "zod";
import { autentica, creaSessione } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Freno ai tentativi di accesso: 8 fallimenti per IP in 15 minuti.
 *
 * Il contatore sta in Redis con TTL, quindi si azzera da solo e vale per
 * tutte le istanze dell'app. Un login riuscito lo cancella, così chi sbaglia
 * e poi indovina non resta bloccato.
 */
const MAX_TENTATIVI = 8;
const FINESTRA = 60 * 15;

function indirizzo(req: Request) {
  const f = req.headers.get("x-forwarded-for");
  return f?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "sconosciuto";
}

async function tentativi(chiave: string) {
  try {
    const n = await redis.incr(chiave);
    if (n === 1) await redis.expire(chiave, FINESTRA);
    return n;
  } catch {
    // Redis giù: non blocchiamo l'accesso legittimo.
    return 0;
  }
}

const Credenziali = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const chiave = `telaio:login:${indirizzo(req)}`;
  try {
    const gia = Number((await redis.get(chiave)) ?? 0);
    if (gia >= MAX_TENTATIVI) {
      return NextResponse.json(
        { ok: false, errore: "Troppi tentativi. Riprova tra qualche minuto." },
        { status: 429 },
      );
    }
  } catch {
    /* senza Redis si prosegue senza freno */
  }

  const corpo = await req.json().catch(() => null);
  const parsed = Credenziali.safeParse(corpo);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errore: "Email o password non validi" },
      { status: 400 },
    );
  }

  const utente = await autentica(parsed.data.email, parsed.data.password);
  if (!utente) {
    await tentativi(chiave);
    // Messaggio unico: non diciamo se a mancare è l'email o la password.
    return NextResponse.json(
      { ok: false, errore: "Email o password non corretti" },
      { status: 401 },
    );
  }

  try {
    await redis.del(chiave);
  } catch {
    /* best-effort */
  }
  await creaSessione(utente);
  return NextResponse.json({ ok: true, nome: utente.nome });
}
