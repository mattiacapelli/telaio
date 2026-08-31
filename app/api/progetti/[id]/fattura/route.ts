import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { prossimoNumeroFattura } from "@/lib/numerazione";
import { registraEvento } from "@/lib/eventi";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Genera una fattura con le sole ore fatturabili di questo progetto.
 *
 * Come per la generazione globale, le registrazioni vengono collegate alla
 * riga creata: è quel legame a impedire che finiscano due volte in fattura.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const progetto = await prisma.progetto.findUnique({
    where: { id },
    include: { cliente: true },
  });
  if (!progetto) {
    return NextResponse.json({ errore: "progetto inesistente" }, { status: 404 });
  }
  if (!progetto.cliente) {
    return NextResponse.json(
      { errore: "un progetto interno non ha un cliente da fatturare" },
      { status: 400 },
    );
  }
  const cliente = progetto.cliente;

  const [registrazioni, costi] = await Promise.all([
    prisma.registrazioneOre.findMany({
      where: { progettoId: id, fatturabile: true, rigaFatturaId: null, eliminataIl: null },
    }),
    // I costi rimborsabili vanno in fattura accanto alle ore, come righe
    // separate: il cliente deve distinguere il lavoro dalle spese vive.
    prisma.costo.findMany({
      where: { progettoId: id, rimborsabile: true, rigaFatturaId: null, eliminataIl: null },
    }),
  ]);
  if (registrazioni.length === 0 && costi.length === 0) {
    return NextResponse.json(
      { errore: "nessuna ora o costo da fatturare per questo progetto" },
      { status: 400 },
    );
  }

  const oreTotali = registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const tariffa = n(cliente.tariffaOraria);
  const totaleCosti = costi.reduce((s, c) => s + n(c.importo), 0);
  const imponibile = oreTotali * tariffa + totaleCosti;

  const fattura = await prisma.$transaction(async (tx) => {
    const f = await tx.fattura.create({
      data: {
        numero: await prossimoNumeroFattura(),
        clienteId: cliente.id,
        stato: "DA_EMETTERE",
        imponibile,
        scadeIl: new Date(Date.now() + cliente.terminiPagamento * 86400000),
        righe: {
          create: [
            ...(oreTotali > 0
              ? [{ descrizione: progetto.nome, quantita: oreTotali, prezzo: tariffa, ordine: 0 }]
              : []),
            ...costi.map((c, i) => ({
              descrizione: c.descrizione,
              quantita: 1,
              prezzo: n(c.importo),
              ordine: i + 1,
            })),
          ],
        },
      },
      include: { righe: true },
    });

    if (registrazioni.length > 0) {
      await tx.registrazioneOre.updateMany({
        where: { id: { in: registrazioni.map((r) => r.id) } },
        data: { rigaFatturaId: f.righe[0].id },
      });
    }

    // Ogni costo si lega alla propria riga: è quel legame a impedire che
    // finisca due volte in fattura.
    for (const c of costi) {
      const riga = f.righe.find((r) => r.descrizione === c.descrizione);
      if (riga) {
        await tx.costo.update({ where: { id: c.id }, data: { rigaFatturaId: riga.id } });
      }
    }

    return f;
  });

  await registraEvento(id, "fattura", `Fattura ${fattura.numero} generata`, {
    dettaglio: `${oreTotali.toLocaleString("it-IT")} h · ${imponibile.toLocaleString("it-IT")} EUR`,
    autore: sessione.email,
  });

  await invalidate();
  return NextResponse.json(
    { ok: true, id: fattura.id, numero: fattura.numero, imponibile },
    { status: 201 },
  );
}
