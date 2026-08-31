import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { CATALOGO_EVENTI } from "@/lib/webhook";

export const dynamic = "force-dynamic";

const CHIAVI_EVENTO = CATALOGO_EVENTI.map((e) => e.chiave) as [string, ...string[]];

export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  const webhook = await prisma.webhook.findMany({
    where: { eliminataIl: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nome: true, url: true, eventi: true, attivo: true, createdAt: true,
      _count: { select: { consegne: true } },
    },
  });
  return NextResponse.json(webhook);
}

const Nuovo = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  url: z.string().url("indirizzo non valido"),
  eventi: z.array(z.enum(["*", ...CHIAVI_EVENTO])).min(1, "scegli almeno un evento"),
});

/** Crea un webhook. Il secret si mostra una sola volta, come le API key. */
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

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const w = await prisma.webhook.create({
    data: { nome: d.nome, url: d.url, eventi: d.eventi, secret },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: w.id, secret }, { status: 201 });
}
