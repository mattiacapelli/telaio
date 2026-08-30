import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Annulla un pagamento registrato per errore. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const incasso = await prisma.incasso.findUnique({
    where: { id },
    include: { fattura: { include: { incassi: true } } },
  });
  if (!incasso) {
    return NextResponse.json({ errore: "incasso inesistente" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.incasso.delete({ where: { id } });

    // Tolto il pagamento la fattura non è più saldata: torna al suo stato
    // precedente, scaduta se il termine è passato.
    const restanti = incasso.fattura.incassi
      .filter((i) => i.id !== id)
      .reduce((s, i) => s + n(i.importo), 0);

    if (restanti < n(incasso.fattura.imponibile) - 0.01) {
      const scaduta =
        incasso.fattura.scadeIl && new Date(incasso.fattura.scadeIl) < new Date();
      await tx.fattura.update({
        where: { id: incasso.fatturaId },
        data: { stato: scaduta ? "SCADUTA" : "EMESSA" },
      });
    }
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}
