import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { prossimoNumeroPreventivo } from "@/lib/numerazione";
import { calcolaPreventivo } from "@/lib/calcoli";

export const dynamic = "force-dynamic";

const Voce = z.object({
  descrizione: z.string().min(1, "descrizione obbligatoria"),
  nota: z.string().optional().nullable(),
  quantita: z.coerce.number().positive("la quantità deve essere positiva"),
  unita: z.enum(["ORE", "GIORNI", "CORPO", "PEZZI"]).default("ORE"),
  prezzo: z.coerce.number().nonnegative(),
  sconto: z.coerce.number().min(0).max(100).default(0),
});

const NuovoPreventivo = z.object({
  titolo: z.string().min(1, "titolo obbligatorio"),
  clienteId: z.string().min(1, "cliente obbligatorio"),
  referenteId: z.string().optional().nullable(),
  scadeIl: z.string().optional().nullable(),
  scontoPercento: z.coerce.number().min(0).max(100).default(0),
  aliquotaIva: z.coerce.number().min(0).max(100).default(22),
  probabilita: z.coerce.number().min(0).max(100).optional().nullable(),
  premessa: z.string().optional().nullable(),
  tempiConsegna: z.string().optional().nullable(),
  modalitaPagamento: z.string().optional().nullable(),
  validitaGiorni: z.coerce.number().int().positive().optional().nullable(),
  note: z.string().optional().nullable(),
  voci: z.array(Voce).min(1, "serve almeno una voce"),
});

export async function POST(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = NuovoPreventivo.safeParse(await req.json().catch(() => null));
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

  // Il referente deve appartenere al cliente scelto, altrimenti il documento
  // sarebbe indirizzato a una persona di un'altra azienda.
  if (d.referenteId) {
    const r = await prisma.referente.findFirst({
      where: { id: d.referenteId, clienteId: d.clienteId },
      select: { id: true },
    });
    if (!r) {
      return NextResponse.json(
        { errore: "il referente non appartiene a questo cliente" },
        { status: 400 },
      );
    }
  }

  // L'imponibile è ricalcolato dal server: non lo accettiamo dal client, così
  // non può divergere dalle voci salvate.
  const riepilogo = calcolaPreventivo(d.voci, d.scontoPercento, d.aliquotaIva);

  const preventivo = await prisma.preventivo.create({
    data: {
      numero: await prossimoNumeroPreventivo(),
      titolo: d.titolo,
      clienteId: d.clienteId,
      referenteId: d.referenteId || null,
      stato: "BOZZA",
      imponibile: riepilogo.imponibile,
      scontoPercento: d.scontoPercento,
      aliquotaIva: d.aliquotaIva,
      probabilita: d.probabilita ?? null,
      premessa: d.premessa || null,
      tempiConsegna: d.tempiConsegna || null,
      modalitaPagamento: d.modalitaPagamento || null,
      validitaGiorni: d.validitaGiorni ?? null,
      note: d.note || null,
      scadeIl: d.scadeIl ? new Date(d.scadeIl) : null,
      voci: {
        create: d.voci.map((v, i) => ({
          descrizione: v.descrizione,
          nota: v.nota || null,
          quantita: v.quantita,
          unita: v.unita,
          prezzo: v.prezzo,
          sconto: v.sconto,
          ordine: i,
        })),
      },
    },
    select: { id: true, numero: true },
  });

  await invalidate();
  return NextResponse.json(
    { ok: true, ...preventivo, ...riepilogo },
    { status: 201 },
  );
}
