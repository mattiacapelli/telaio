import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { generaCoppiaChiavi, cifraChiavePrivata } from "@/lib/licenze-crypto";

export const dynamic = "force-dynamic";

const Genera = z.object({
  conferma: z.boolean().optional().default(false),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const p = await prisma.prodotto.findUnique({
    where: { id },
    select: { chiavePubblicaMaster: true, chiaveMasterGenerataIl: true },
  });
  if (!p) {
    return NextResponse.json({ errore: "prodotto inesistente" }, { status: 404 });
  }

  return NextResponse.json({
    chiavePubblicaMaster: p.chiavePubblicaMaster,
    chiaveMasterGenerataIl: p.chiaveMasterGenerataIl,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Genera.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ errore: "dati non validi" }, { status: 400 });
  }

  const p = await prisma.prodotto.findUnique({
    where: { id },
    select: { modalitaLicenza: true, chiavePubblicaMaster: true },
  });
  if (!p) {
    return NextResponse.json({ errore: "prodotto inesistente" }, { status: 404 });
  }
  if (p.modalitaLicenza !== "OFFLINE" && p.modalitaLicenza !== "ENTRAMBE") {
    return NextResponse.json(
      { errore: "il prodotto non è in modalità offline: imposta prima la modalità di licenza" },
      { status: 400 },
    );
  }
  // Rigenerare invalida la verifica di tutti i file offline già emessi per
  // questo prodotto: il software compilato con la vecchia pubblica non
  // riconoscerà più i nuovi certificati. Richiede conferma esplicita.
  if (p.chiavePubblicaMaster && !parsed.data.conferma) {
    return NextResponse.json(
      { errore: "esiste già una chiave master: conferma esplicitamente per rigenerarla" },
      { status: 409 },
    );
  }

  const { pubblica, privata } = generaCoppiaChiavi();
  const chiavePrivataMasterCifrata = cifraChiavePrivata(privata);

  await prisma.prodotto.update({
    where: { id },
    data: {
      chiavePubblicaMaster: pubblica,
      chiavePrivataMasterCifrata,
      chiaveMasterGenerataIl: new Date(),
    },
  });

  await invalidate();
  return NextResponse.json({ chiavePubblicaMaster: pubblica }, { status: 201 });
}
