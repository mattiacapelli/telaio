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

  const registrazioni = await prisma.registrazioneOre.findMany({
    where: { progettoId: id, fatturabile: true, rigaFatturaId: null },
  });
  if (registrazioni.length === 0) {
    return NextResponse.json(
      { errore: "nessuna ora da fatturare per questo progetto" },
      { status: 400 },
    );
  }

  const oreTotali = registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const tariffa = n(progetto.cliente.tariffaOraria);
  const imponibile = oreTotali * tariffa;

  const fattura = await prisma.$transaction(async (tx) => {
    const f = await tx.fattura.create({
      data: {
        numero: await prossimoNumeroFattura(),
        clienteId: progetto.clienteId,
        stato: "DA_EMETTERE",
        imponibile,
        scadeIl: new Date(Date.now() + progetto.cliente.terminiPagamento * 86400000),
        righe: {
          create: [
            {
              descrizione: progetto.nome,
              quantita: oreTotali,
              prezzo: tariffa,
              ordine: 0,
            },
          ],
        },
      },
      include: { righe: true },
    });

    await tx.registrazioneOre.updateMany({
      where: { id: { in: registrazioni.map((r) => r.id) } },
      data: { rigaFatturaId: f.righe[0].id },
    });

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
