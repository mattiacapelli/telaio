import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { prossimoNumeroContratto } from "@/lib/contratti";
import { testiPredefiniti } from "@/lib/testi";

export const dynamic = "force-dynamic";

const Nuovo = z.object({
  titolo: z.string().min(1, "il titolo è obbligatorio"),
  clienteId: z.string().min(1, "cliente obbligatorio"),
  progettoId: z.string().optional().nullable(),
  tipo: z.enum(["ASSISTENZA_ORE", "CANONE_FISSO", "PROGETTO"]).default("ASSISTENZA_ORE"),
  canone: z.coerce.number().nonnegative(),
  periodicita: z.enum(["MENSILE", "TRIMESTRALE", "SEMESTRALE", "ANNUALE"]).default("MENSILE"),
  monteOre: z.coerce.number().nonnegative().optional().nullable(),
  tariffaExtra: z.coerce.number().nonnegative().optional().nullable(),
  inizioIl: z.string().min(1, "data di inizio obbligatoria"),
  premessa: z.string().optional().nullable(),
  oggetto: z.string().optional().nullable(),
  condizioniPagamento: z.string().optional().nullable(),
  condizioniServizio: z.string().optional().nullable(),
  scadeIl: z.string().optional().nullable(),
  rinnovoAutomatico: z.boolean().default(false),
  preavvisoGiorni: z.coerce.number().int().nonnegative().default(30),
  note: z.string().optional().nullable(),
  aziendaId: z.string().optional().nullable(),
});

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

  const cliente = await prisma.cliente.findUnique({
    where: { id: d.clienteId },
    select: { id: true },
  });
  if (!cliente) {
    return NextResponse.json({ errore: "cliente inesistente" }, { status: 400 });
  }

  // Un contratto di assistenza senza monte ore non avrebbe nulla da scalare.
  if (d.tipo === "ASSISTENZA_ORE" && !d.monteOre) {
    return NextResponse.json(
      { errore: "un contratto di assistenza richiede un monte ore" },
      { status: 400 },
    );
  }

  // I testi non indicati vengono presi dai modelli predefiniti, e da lì in poi
  // appartengono al contratto: modificare il modello non lo riscrive.
  const predefiniti = await testiPredefiniti("CONTRATTO");

  const c = await prisma.contratto.create({
    data: {
      numero: await prossimoNumeroContratto(),
      premessa: d.premessa ?? predefiniti.premessa ?? null,
      oggetto: d.oggetto ?? predefiniti.oggetto ?? null,
      condizioniPagamento: d.condizioniPagamento ?? predefiniti.condizioniPagamento ?? null,
      condizioniServizio: d.condizioniServizio ?? predefiniti.condizioniServizio ?? null,
      titolo: d.titolo,
      clienteId: d.clienteId,
      progettoId: d.progettoId || null,
      tipo: d.tipo,
      canone: d.canone,
      periodicita: d.periodicita,
      monteOre: d.tipo === "ASSISTENZA_ORE" ? d.monteOre : null,
      tariffaExtra: d.tariffaExtra ?? null,
      inizioIl: new Date(d.inizioIl),
      scadeIl: d.scadeIl ? new Date(d.scadeIl) : null,
      rinnovoAutomatico: d.rinnovoAutomatico,
      preavvisoGiorni: d.preavvisoGiorni,
      note: d.note || null,
      aziendaId: d.aziendaId || null,
    },
    select: { id: true, numero: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...c }, { status: 201 });
}
