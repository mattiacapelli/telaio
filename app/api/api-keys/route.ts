import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { generaChiave, hashChiave, suffissoChiave } from "@/lib/apikey";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  const chiavi = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nome: true, suffisso: true, scadeIl: true,
      ultimoUsoIl: true, revocataIl: true, createdAt: true,
    },
  });
  return NextResponse.json(chiavi);
}

const Nuova = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  scadeIl: z.string().optional().nullable(),
});

/**
 * Crea una nuova API key. La chiave in chiaro viene restituita solo qui:
 * dopo questa risposta non è più recuperabile da nessuna parte, nemmeno
 * dall'amministratore — se si perde, va revocata e se ne crea un'altra.
 */
export async function POST(req: Request) {
  if (!(await leggiSessione())) {
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

  const chiave = generaChiave();
  const k = await prisma.apiKey.create({
    data: {
      nome: d.nome,
      hash: hashChiave(chiave),
      suffisso: suffissoChiave(chiave),
      scadeIl: d.scadeIl ? new Date(d.scadeIl) : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: k.id, chiave }, { status: 201 });
}
