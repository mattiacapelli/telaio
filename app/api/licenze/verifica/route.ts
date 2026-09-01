import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Endpoint pubblico: il software installato presso il cliente lo interroga
 * per sapere se la sua licenza è ancora valida. Nessuna sessione utente:
 * il "segreto" è l'id della licenza stesso, che il software già conosce
 * (comunicato all'attivazione o presente nel payload del file offline).
 *
 * Nessuna cache: legge sempre lo stato corrente, quindi sospendere o
 * disdire una licenza da Telaio è visibile qui al controllo successivo.
 *
 * TODO: nessun rate limiting oggi — da considerare se l'endpoint viene
 * esposto pubblicamente su un dominio raggiungibile da chiunque.
 */

const Verifica = z.object({
  licenzaId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Verifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "dati non validi" }, { status: 400 });
  }

  const licenza = await prisma.licenzaProdotto.findUnique({
    where: { id: parsed.data.licenzaId },
    select: {
      stato: true,
      scadeIl: true,
      eliminataIl: true,
      prodotto: { select: { modalitaLicenza: true } },
    },
  });

  // Sempre 200, mai 404: un 404 rivelerebbe per differenza di status quali
  // id esistono, trasformando l'endpoint in un oracolo per enumerarli.
  if (!licenza || licenza.eliminataIl) {
    return NextResponse.json({ valida: false, motivo: "licenza inesistente" });
  }
  if (licenza.prodotto.modalitaLicenza === "NESSUNA") {
    return NextResponse.json({ valida: false, motivo: "prodotto non abilitato alla verifica online" });
  }

  const scaduta = Boolean(licenza.scadeIl && licenza.scadeIl < new Date());
  return NextResponse.json({
    valida: licenza.stato === "ATTIVA" && !scaduta,
    stato: licenza.stato,
    scadeIl: licenza.scadeIl,
  });
}
