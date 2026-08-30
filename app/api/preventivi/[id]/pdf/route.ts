import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { generaPdfPreventivo } from "@/lib/pdf";
import { etichettaRevisione, type VoceCongelata } from "@/lib/revisioni";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * PDF del preventivo, rigenerato a ogni richiesta dai dati a database.
 *
 * `?revisione=2` ristampa una versione congelata invece di quella corrente:
 * il documento che il cliente ha ricevuto resta riproducibile anche dopo
 * modifiche successive.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const richiesta = new URL(req.url).searchParams.get("revisione");

  const [p, impostazioni] = await Promise.all([
    prisma.preventivo.findUnique({
      where: { id },
      include: {
        cliente: true,
        referente: true,
        voci: { orderBy: { ordine: "asc" } },
        revisioni: true,
      },
    }),
    prisma.impostazioni.findUnique({ where: { id: 1 } }),
  ]);

  if (!p) {
    return NextResponse.json({ errore: "preventivo inesistente" }, { status: 404 });
  }

  // Di default il documento corrente; con ?revisione=N la copia congelata.
  let voci = p.voci.map((v) => ({
    descrizione: v.descrizione,
    nota: v.nota,
    quantita: n(v.quantita),
    unita: v.unita as string,
    prezzo: n(v.prezzo),
    sconto: n(v.sconto),
  }));
  let titolo = p.titolo;
  let numeroRevisione = p.revisioneCorrente;

  if (richiesta) {
    const rev = p.revisioni.find((r) => r.numero === Number(richiesta));
    if (!rev) {
      return NextResponse.json({ errore: "revisione inesistente" }, { status: 404 });
    }
    const congelate = (rev.voci as unknown as VoceCongelata[]) ?? [];
    voci = congelate.map((v) => ({
      descrizione: v.descrizione,
      nota: v.nota,
      quantita: v.quantita,
      unita: v.unita,
      prezzo: v.prezzo,
      sconto: v.sconto ?? 0,
    }));
    titolo = rev.titolo;
    numeroRevisione = rev.numero;
  }

  const pdf = await generaPdfPreventivo({
    numero: p.numero,
    revisione: etichettaRevisione(numeroRevisione) || undefined,
    titolo,
    emittente: {
      ragioneSociale: impostazioni?.ragioneSociale ?? "Studio",
      partitaIva: impostazioni?.partitaIva,
      iban: impostazioni?.iban,
    },
    cliente: {
      ragioneSociale: p.cliente.ragioneSociale,
      partitaIva: p.cliente.partitaIva,
      citta: p.cliente.citta,
    },
    referente: p.referente ? `${p.referente.nome} ${p.referente.cognome}` : null,
    dataEmissione: p.inviatoIl ?? p.createdAt,
    scadeIl: p.scadeIl,
    validitaGiorni: p.validitaGiorni,
    premessa: p.premessa,
    tempiConsegna: p.tempiConsegna,
    modalitaPagamento: p.modalitaPagamento,
    note: p.note,
    scontoPercento: n(p.scontoPercento),
    aliquotaIva: n(p.aliquotaIva),
    voci,
  });

  const nomeFile = `${p.numero.replace(/\//g, "-")}${
    numeroRevisione > 1 ? `-r${numeroRevisione}` : ""
  }.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` apre l'anteprima nel browser; il salvataggio resta a un clic.
      "Content-Disposition": `inline; filename="${nomeFile}"`,
      "Cache-Control": "no-store",
    },
  });
}
