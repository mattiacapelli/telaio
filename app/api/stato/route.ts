import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { registraEvento } from "@/lib/eventi";
import { scatena } from "@/lib/workflow/motore";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Sposta un record da una colonna all'altra di una board.
 *
 * Le entità hanno enum di stato diversi, quindi ognuna dichiara qui i valori
 * ammessi: uno stato non previsto viene rifiutato invece di arrivare al DB.
 */
const BOARD = {
  preventivo: {
    stati: ["BOZZA", "INVIATO", "ACCETTATO", "RIFIUTATO"],
    aggiorna: (id: string, stato: string) =>
      prisma.preventivo.update({
        where: { id },
        data: {
          stato: stato as never,
          // Passando a "inviato" registriamo la data, se non c'è già.
          ...(stato === "INVIATO" ? { inviatoIl: new Date() } : {}),
        },
      }),
  },
  progetto: {
    stati: ["DA_AVVIARE", "IN_CORSO", "IN_PAUSA", "CONCLUSO"],
    aggiorna: (id: string, stato: string) =>
      prisma.progetto.update({ where: { id }, data: { stato: stato as never } }),
  },
  attivita: {
    stati: ["DA_FARE", "IN_CORSO", "BLOCCATA", "FATTA"],
    aggiorna: (id: string, stato: string) =>
      prisma.attivita.update({
        where: { id },
        data: {
          stato: stato as never,
          // "Fatta" fissa la data di completamento; uscirne la azzera.
          completataIl: stato === "FATTA" ? new Date() : null,
        },
      }),
  },
  ticket: {
    stati: ["APERTO", "IN_LAVORAZIONE", "ATTESA_CLIENTE", "RISOLTO", "CHIUSO"],
    aggiorna: (id: string, stato: string) =>
      prisma.ticket.update({
        where: { id },
        data: {
          stato: stato as never,
          risoltoIl:
            stato === "RISOLTO" || stato === "CHIUSO" ? new Date() : null,
        },
      }),
  },
  fattura: {
    stati: ["DA_EMETTERE", "EMESSA", "PAGATA", "SCADUTA"],
    aggiorna: (id: string, stato: string) =>
      prisma.fattura.update({
        where: { id },
        data: {
          stato: stato as never,
          ...(stato === "EMESSA" ? { emessaIl: new Date() } : {}),
        },
      }),
  },
} as const;

type Entita = keyof typeof BOARD;

export async function POST(req: Request) {
  // Il middleware verifica solo che il cookie esista (gira su edge, senza
  // Redis): senza questo controllo un cookie inventato o già revocato
  // riuscirebbe a scrivere sul database.
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entita = body?.entita as Entita | undefined;
  const id = body?.id as string | undefined;
  const stato = body?.stato as string | undefined;

  if (!entita || !id || !stato || !(entita in BOARD)) {
    return NextResponse.json({ errore: "richiesta non valida" }, { status: 400 });
  }

  const board = BOARD[entita];
  if (!board.stati.includes(stato as never)) {
    return NextResponse.json(
      { errore: `stato "${stato}" non ammesso per ${entita}` },
      { status: 400 },
    );
  }

  try {
    await board.aggiorna(id, stato);

    // Il diario del progetto tiene traccia anche dei cambi di stato fatti
    // trascinando una card sulla board.
    if (entita === "progetto") {
      await registraEvento(id, "stato", `Stato → ${stato.toLowerCase().replace("_", " ")}`, {
        autore: sessione.email,
      });
    }

    // I workflow reagiscono ai cambi di stato: un preventivo accettato può
    // aprire un progetto, una fattura emessa può far partire un promemoria.
    await scatenaPerEntita(entita, id, stato);

    await invalidate();
    return NextResponse.json({ ok: true });
  } catch {
    // Tipicamente: record inesistente (P2025).
    return NextResponse.json(
      { errore: "record non trovato o aggiornamento fallito" },
      { status: 404 },
    );
  }
}

/** Costruisce il contesto e lancia i workflow legati al nuovo stato. */
async function scatenaPerEntita(entita: string, id: string, stato: string) {
  const evento = `${entita}.${stato.toLowerCase()}`;

  if (entita === "preventivo") {
    const p = await prisma.preventivo.findUnique({
      where: { id },
      include: { cliente: { include: { referenti: { take: 1 } } } },
    });
    if (!p) return;
    await scatena(evento, {
      entita: "preventivo",
      id,
      dati: {
        numero: p.numero,
        titolo: p.titolo,
        cliente: p.cliente.ragioneSociale,
        imponibile: n(p.imponibile),
        stato: p.stato,
        emailReferente: p.cliente.referenti[0]?.email ?? null,
      },
    });
    return;
  }

  if (entita === "fattura") {
    const f = await prisma.fattura.findUnique({
      where: { id },
      include: { cliente: { include: { referenti: { take: 1 } } } },
    });
    if (!f) return;
    await scatena(evento, {
      entita: "fattura",
      id,
      dati: {
        numero: f.numero,
        cliente: f.cliente.ragioneSociale,
        imponibile: n(f.imponibile),
        stato: f.stato,
        scadeIl: f.scadeIl ? f.scadeIl.toISOString() : null,
        emailReferente: f.cliente.referenti[0]?.email ?? null,
      },
    });
    return;
  }

  if (entita === "progetto") {
    const pr = await prisma.progetto.findUnique({
      where: { id },
      include: { cliente: true },
    });
    if (!pr) return;
    await scatena(evento, {
      entita: "progetto",
      id,
      dati: {
        nome: pr.nome,
        cliente: pr.cliente.ragioneSociale,
        valore: n(pr.valore),
        stato: pr.stato,
      },
    });
  }
}
