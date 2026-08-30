import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { prossimoNumeroFattura } from "@/lib/numerazione";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Genera una fattura dalle ore fatturabili non ancora fatturate di un cliente.
 *
 * Le registrazioni vengono collegate alla riga di fattura creata: è questo
 * legame (`rigaFatturaId`) a impedire che le stesse ore finiscano due volte
 * in fattura.
 */
export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const righe = await prisma.registrazioneOre.findMany({
    where: { fatturabile: true, rigaFatturaId: null },
    include: {
      progetto: { include: { cliente: true } },
      ticket: { include: { cliente: true } },
    },
  });

  // Raggruppa per cliente: una proposta di fattura per ciascuno.
  const perCliente = new Map<
    string,
    { cliente: string; clienteId: string; ore: number; importo: number }
  >();

  for (const r of righe) {
    const cliente = r.progetto?.cliente ?? r.ticket?.cliente;
    if (!cliente) continue;
    const g = perCliente.get(cliente.id) ?? {
      cliente: cliente.ragioneSociale,
      clienteId: cliente.id,
      ore: 0,
      importo: 0,
    };
    g.ore += n(r.ore);
    g.importo += n(r.ore) * n(cliente.tariffaOraria);
    perCliente.set(cliente.id, g);
  }

  return NextResponse.json({ proposte: [...perCliente.values()] });
}

const DaOre = z.object({ clienteId: z.string().min(1) });

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = DaOre.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "cliente obbligatorio" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: parsed.data.clienteId },
  });
  if (!cliente) {
    return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
  }

  const registrazioni = await prisma.registrazioneOre.findMany({
    where: {
      fatturabile: true,
      rigaFatturaId: null,
      OR: [
        { progetto: { clienteId: cliente.id } },
        { ticket: { clienteId: cliente.id } },
      ],
    },
    include: { progetto: true, ticket: true },
  });

  if (registrazioni.length === 0) {
    return NextResponse.json(
      { errore: "nessuna ora da fatturare per questo cliente" },
      { status: 400 },
    );
  }

  // Una riga per progetto (le ore su ticket confluiscono in "Assistenza").
  const gruppi = new Map<string, number>();
  for (const r of registrazioni) {
    const etichetta = r.progetto?.nome ?? "Assistenza e interventi";
    gruppi.set(etichetta, (gruppi.get(etichetta) ?? 0) + n(r.ore));
  }

  const tariffa = n(cliente.tariffaOraria);
  const imponibile = [...gruppi.values()].reduce((s, o) => s + o * tariffa, 0);

  // Transazione: la fattura e il collegamento delle ore devono valere insieme,
  // altrimenti le stesse ore resterebbero fatturabili una seconda volta.
  const fattura = await prisma.$transaction(async (tx) => {
    const f = await tx.fattura.create({
      data: {
        numero: await prossimoNumeroFattura(),
        clienteId: cliente.id,
        stato: "DA_EMETTERE",
        imponibile,
        scadeIl: new Date(Date.now() + cliente.terminiPagamento * 86400000),
        righe: {
          create: [...gruppi.entries()].map(([descrizione, ore], i) => ({
            descrizione,
            quantita: ore,
            prezzo: tariffa,
            ordine: i,
          })),
        },
      },
      include: { righe: true },
    });

    for (const [descrizione, _] of gruppi) {
      const riga = f.righe.find((r) => r.descrizione === descrizione)!;
      const ids = registrazioni
        .filter((r) => (r.progetto?.nome ?? "Assistenza e interventi") === descrizione)
        .map((r) => r.id);
      await tx.registrazioneOre.updateMany({
        where: { id: { in: ids } },
        data: { rigaFatturaId: riga.id },
      });
    }

    return f;
  });

  await invalidate();
  return NextResponse.json(
    { ok: true, id: fattura.id, numero: fattura.numero, imponibile },
    { status: 201 },
  );
}
