import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { scatena } from "@/lib/workflow/motore";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  fatturaId: z.string().min(1, "fattura obbligatoria"),
  data: z.string().min(1, "la data è obbligatoria"),
  importo: z.coerce.number().positive("l'importo deve essere maggiore di zero"),
  metodo: z.enum(["BONIFICO", "CARTA", "CONTANTI", "ALTRO"]).default("BONIFICO"),
  contoId: z.string().optional().nullable(),
  nota: z.string().optional().nullable(),
});

/**
 * Registra un pagamento ricevuto.
 *
 * Quando il totale incassato raggiunge l'imponibile, la fattura passa a
 * PAGATA: è il passaggio che chiude il ciclo del denaro, e senza il quale
 * "da incassare" resterebbe fermo per sempre.
 */
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

  const fattura = await prisma.fattura.findUnique({
    where: { id: d.fatturaId },
    include: { incassi: true, cliente: true },
  });
  if (!fattura) {
    return NextResponse.json({ errore: "fattura inesistente" }, { status: 400 });
  }
  if (fattura.stato === "DA_EMETTERE") {
    return NextResponse.json(
      { errore: "la fattura non è ancora stata emessa" },
      { status: 400 },
    );
  }

  const giaIncassato = fattura.incassi.reduce((s, i) => s + n(i.importo), 0);
  const dovuto = n(fattura.imponibile);
  const residuo = dovuto - giaIncassato;

  // Un incasso superiore al residuo è quasi certamente un errore di
  // digitazione: meglio fermarlo che sporcare i conti.
  if (d.importo > residuo + 0.01) {
    return NextResponse.json(
      {
        errore: `l'importo supera il residuo di ${(d.importo - residuo).toFixed(2)} EUR (residuo: ${residuo.toFixed(2)})`,
      },
      { status: 400 },
    );
  }

  const incasso = await prisma.$transaction(async (tx) => {
    const i = await tx.incasso.create({
      data: {
        fatturaId: d.fatturaId,
        data: new Date(`${d.data}T00:00:00.000Z`),
        importo: d.importo,
        metodo: d.metodo,
        contoId: d.contoId || null,
        nota: d.nota || null,
      },
      select: { id: true, importo: true },
    });

    // Saldata: aggiorniamo lo stato nella stessa transazione, così non
    // esiste un istante in cui la fattura è incassata ma risulta ancora
    // da riscuotere.
    if (giaIncassato + d.importo >= dovuto - 0.01) {
      await tx.fattura.update({
        where: { id: d.fatturaId },
        data: { stato: "PAGATA" },
      });
    }

    return i;
  });

  const saldata = giaIncassato + d.importo >= dovuto - 0.01;
  if (saldata) {
    await scatena("fattura.pagata", {
      entita: "fattura",
      id: d.fatturaId,
      dati: {
        numero: fattura.numero,
        cliente: fattura.cliente.ragioneSociale,
        imponibile: dovuto,
        stato: "PAGATA",
      },
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true, saldata, ...incasso }, { status: 201 });
}
