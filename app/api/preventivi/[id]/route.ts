import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { leggiSessione } from "@/lib/auth";
import { congelaRevisione, richiedeRevisione, motivaSuccessiva } from "@/lib/revisioni";
import { calcolaPreventivo } from "@/lib/calcoli";

export const dynamic = "force-dynamic";

const Voce = z.object({
  descrizione: z.string().min(1),
  nota: z.string().optional().nullable(),
  quantita: z.coerce.number().positive(),
  unita: z.enum(["ORE", "GIORNI", "CORPO", "PEZZI"]).default("ORE"),
  prezzo: z.coerce.number().nonnegative(),
  sconto: z.coerce.number().min(0).max(100).default(0),
});

const Modifica = z.object({
  titolo: z.string().min(1),
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
  aziendaId: z.string().optional().nullable(),
  voci: z.array(Voce).min(1, "serve almeno una voce"),
  /** Motivo della revisione, richiesto quando il preventivo è già inviato. */
  motivo: z.string().optional().nullable(),
});

/**
 * Modifica un preventivo.
 *
 * In BOZZA si sovrascrive: il documento non è ancora uscito dallo studio.
 * Da INVIATO in poi, prima di sovrascrivere si congela lo stato attuale in una
 * revisione, così la versione che il cliente ha ricevuto resta consultabile.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Modifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const attuale = await prisma.preventivo.findUnique({
    where: { id },
    select: {
      id: true,
      stato: true,
      revisioneCorrente: true,
      motivoCorrente: true,
    },
  });
  if (!attuale) {
    return NextResponse.json({ errore: "preventivo inesistente" }, { status: 404 });
  }

  // Un preventivo già accettato non si tocca: da lì nasce il progetto.
  if (attuale.stato === "ACCETTATO") {
    return NextResponse.json(
      { errore: "un preventivo accettato non può essere modificato" },
      { status: 409 },
    );
  }

  const nuovaRevisione = richiedeRevisione(attuale.stato);
  const riepilogo = calcolaPreventivo(d.voci, d.scontoPercento, d.aliquotaIva);

  const esito = await prisma.$transaction(async (tx) => {
    let numeroRevisione = attuale.revisioneCorrente;

    if (nuovaRevisione) {
      // Congela com'è ADESSO, prima di sovrascrivere.
      const rev = await congelaRevisione(tx, id, { autore: sessione.email });
      // Il motivo salvato sul preventivo spiegava *questa* versione: ora che
      // è congelata, gli appartiene.
      await motivaSuccessiva(
        tx,
        id,
        rev.numero,
        attuale.motivoCorrente,
        sessione.email,
      );
      numeroRevisione = rev.numero + 1;
    }

    // Le voci sono sostituite in blocco: la storia sta nelle revisioni.
    await tx.vocePreventivo.deleteMany({ where: { preventivoId: id } });

    return tx.preventivo.update({
      where: { id },
      data: {
        titolo: d.titolo,
        referenteId: d.referenteId || null,
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
        aziendaId: d.aziendaId || null,
        revisioneCorrente: numeroRevisione,
        // Motivo della modifica appena fatta: descrive la versione che stiamo
        // creando adesso, e la seguirà quando verrà congelata.
        motivoCorrente: d.motivo ?? null,
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
      select: { id: true, numero: true, revisioneCorrente: true },
    });
  });

  await invalidate();
  return NextResponse.json({ ok: true, revisionata: nuovaRevisione, ...esito });
}
