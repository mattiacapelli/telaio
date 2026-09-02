import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { prossimoNumeroFattura } from "@/lib/numerazione";

export const dynamic = "force-dynamic";

const Riga = z.object({
  descrizione: z.string().min(1),
  quantita: z.coerce.number().positive(),
  prezzo: z.coerce.number().nonnegative(),
});

const NuovaFattura = z.object({
  clienteId: z.string().min(1, "cliente obbligatorio"),
  aziendaId: z.string().optional().nullable(),
  righe: z.array(Riga).min(1, "serve almeno una riga"),
  scadeIl: z.string().optional().nullable(),
});

/** Fattura compilata a mano. */
export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = NuovaFattura.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const cliente = await prisma.cliente.findUnique({
    where: { id: d.clienteId },
    select: { id: true, terminiPagamento: true },
  });
  if (!cliente) {
    return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
  }

  const imponibile = d.righe.reduce((s, r) => s + r.quantita * r.prezzo, 0);

  // Se non indicata, la scadenza segue i termini di pagamento del cliente.
  const scadenza = d.scadeIl
    ? new Date(d.scadeIl)
    : new Date(Date.now() + cliente.terminiPagamento * 86400000);

  const fattura = await prisma.fattura.create({
    data: {
      numero: await prossimoNumeroFattura(),
      clienteId: d.clienteId,
      aziendaId: d.aziendaId || null,
      stato: "DA_EMETTERE",
      imponibile,
      scadeIl: scadenza,
      righe: {
        create: d.righe.map((r, i) => ({
          descrizione: r.descrizione,
          quantita: r.quantita,
          prezzo: r.prezzo,
          ordine: i,
        })),
      },
    },
    select: { id: true, numero: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...fattura }, { status: 201 });
}
