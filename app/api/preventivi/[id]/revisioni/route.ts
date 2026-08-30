import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { congelaRevisione, motivaSuccessiva } from "@/lib/revisioni";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Storico completo: revisioni congelate + versione corrente. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const preventivo = await prisma.preventivo.findUnique({
    where: { id },
    include: {
      voci: { orderBy: { ordine: "asc" } },
      revisioni: { orderBy: { numero: "asc" } },
    },
  });
  if (!preventivo) {
    return NextResponse.json({ errore: "preventivo inesistente" }, { status: 404 });
  }

  return NextResponse.json({
    numero: preventivo.numero,
    revisioneCorrente: preventivo.revisioneCorrente,
    storico: preventivo.revisioni.map((r) => ({
      numero: r.numero,
      titolo: r.titolo,
      imponibile: n(r.imponibile),
      motivo: r.motivo,
      autore: r.autore,
      creataIl: r.creataIl,
      voci: r.voci,
      corrente: false,
    })),
    corrente: {
      numero: preventivo.revisioneCorrente,
      titolo: preventivo.titolo,
      imponibile: n(preventivo.imponibile),
      voci: preventivo.voci.map((v) => ({
        descrizione: v.descrizione,
        quantita: n(v.quantita),
        unita: v.unita,
        prezzo: n(v.prezzo),
      })),
      corrente: true,
    },
  });
}

const NuovaRevisione = z.object({ motivo: z.string().optional().nullable() });

/**
 * Crea una revisione esplicita senza modificare nulla: utile per marcare un
 * punto fermo prima di rinegoziare.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = NuovaRevisione.safeParse(await req.json().catch(() => ({})));
  const motivo = parsed.success ? parsed.data.motivo : null;

  const p = await prisma.preventivo.findUnique({
    where: { id },
    select: { id: true, motivoCorrente: true },
  });
  if (!p) {
    return NextResponse.json({ errore: "preventivo inesistente" }, { status: 404 });
  }

  const rev = await prisma.$transaction(async (tx) => {
    const r = await congelaRevisione(tx, id, { autore: sessione.email });
    // La versione congelata eredita il motivo che la descriveva.
    await motivaSuccessiva(tx, id, r.numero, p.motivoCorrente, sessione.email);
    await tx.preventivo.update({
      where: { id },
      data: { revisioneCorrente: r.numero + 1, motivoCorrente: motivo ?? null },
    });
    return r;
  });

  await invalidate();
  return NextResponse.json({ ok: true, revisione: rev.numero }, { status: 201 });
}
