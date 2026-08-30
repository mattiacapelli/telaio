import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  data: z.string().min(1, "la data è obbligatoria"),
  tipo: z.enum(["TRASFERTA", "MATERIALE", "LICENZA", "SERVIZIO_TERZI", "ALTRO"]).default("ALTRO"),
  descrizione: z.string().min(1, "la descrizione è obbligatoria"),
  importo: z.coerce.number().nonnegative().optional(),
  quantita: z.coerce.number().nonnegative().optional().nullable(),
  tariffa: z.coerce.number().nonnegative().optional().nullable(),
  modalita: z.enum(["CHILOMETRICA", "PIE_DI_LISTA", "FORFETTARIA"]).optional().nullable(),
  rimborsabile: z.boolean().default(true),
  progettoId: z.string().optional().nullable(),
  attivitaId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
});

/**
 * Registra un costo sostenuto.
 *
 * Per le trasferte chilometriche l'importo è calcolato da quantità × tariffa,
 * ma viene salvato: la tariffa può cambiare nel tempo e un costo già
 * registrato non deve seguirla.
 */
export async function POST(req: Request) {
  const sessione = await leggiSessione();
  if (!sessione) {
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

  if (!d.progettoId && !d.attivitaId && !d.ticketId) {
    return NextResponse.json(
      { errore: "indica un progetto, un'attività o un ticket" },
      { status: 400 },
    );
  }

  // Chilometrica: l'importo si ricava dai km. Negli altri casi è indicato
  // direttamente, perché è una spesa vera già sostenuta.
  let importo = d.importo ?? 0;
  if (d.modalita === "CHILOMETRICA") {
    if (!d.quantita || !d.tariffa) {
      return NextResponse.json(
        { errore: "per la trasferta chilometrica servono chilometri e tariffa" },
        { status: 400 },
      );
    }
    importo = d.quantita * d.tariffa;
  }

  if (importo <= 0) {
    return NextResponse.json(
      { errore: "l'importo deve essere maggiore di zero" },
      { status: 400 },
    );
  }

  // Come per le ore, il progetto si deduce dal collegamento più specifico:
  // così il costo compare anche nei totali del progetto.
  let progettoId = d.progettoId || null;
  if (d.attivitaId && !progettoId) {
    const a = await prisma.attivita.findUnique({
      where: { id: d.attivitaId },
      select: { progettoId: true },
    });
    progettoId = a?.progettoId ?? null;
  }
  if (d.ticketId && !progettoId) {
    const t = await prisma.ticket.findUnique({
      where: { id: d.ticketId },
      select: { progettoId: true },
    });
    progettoId = t?.progettoId ?? null;
  }

  const c = await prisma.costo.create({
    data: {
      data: new Date(`${d.data}T00:00:00.000Z`),
      tipo: d.tipo,
      descrizione: d.descrizione,
      importo,
      quantita: d.quantita ?? null,
      tariffa: d.tariffa ?? null,
      modalita: d.modalita ?? null,
      rimborsabile: d.rimborsabile,
      progettoId,
      attivitaId: d.attivitaId || null,
      ticketId: d.ticketId || null,
      registratoDa: sessione.email,
    },
    select: { id: true, importo: true },
  });

  if (progettoId) {
    await registraEvento(progettoId, "modifica", `Costo registrato: ${d.descrizione}`, {
      dettaglio: `${n(c.importo).toFixed(2)} EUR · ${d.rimborsabile ? "rimborsabile" : "a carico dello studio"}`,
      autore: sessione.email,
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true, ...c }, { status: 201 });
}
