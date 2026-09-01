import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import {
  generaCoppiaChiavi,
  certificaChiaveLicenza,
  firmaPayload,
  decifraChiavePrivata,
  type PayloadLicenza,
  type FileLicenza,
} from "@/lib/licenze-crypto";

export const dynamic = "force-dynamic";

const Genera = z.object({
  seats: z.coerce.number().int().positive().optional(),
  moduli: z.array(z.string()).optional(),
  hardwareId: z.string().optional(),
  validitaGiorni: z.coerce.number().int().positive().optional(),
});

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
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const licenza = await prisma.licenzaProdotto.findUnique({
    where: { id },
    include: { prodotto: true, cliente: { select: { ragioneSociale: true } } },
  });
  if (!licenza) {
    return NextResponse.json({ errore: "licenza inesistente" }, { status: 404 });
  }
  const { prodotto } = licenza;
  if (prodotto.modalitaLicenza !== "OFFLINE" && prodotto.modalitaLicenza !== "ENTRAMBE") {
    return NextResponse.json(
      { errore: "il prodotto non è in modalità offline" },
      { status: 400 },
    );
  }
  if (!prodotto.chiavePubblicaMaster || !prodotto.chiavePrivataMasterCifrata) {
    return NextResponse.json(
      { errore: "genera prima la chiave master del prodotto" },
      { status: 400 },
    );
  }

  const scadeIl = d.validitaGiorni
    ? new Date(Date.now() + d.validitaGiorni * 86400000).toISOString()
    : licenza.scadeIl
      ? new Date(licenza.scadeIl).toISOString()
      : null;

  const payload: PayloadLicenza = {
    licenzaId: licenza.id,
    prodotto: prodotto.nome,
    cliente: licenza.cliente.ragioneSociale,
    emessaIl: new Date().toISOString(),
    scadeIl,
    ...(d.seats !== undefined ? { seats: d.seats } : {}),
    ...(d.moduli !== undefined ? { moduli: d.moduli } : {}),
    ...(d.hardwareId !== undefined ? { hardwareId: d.hardwareId } : {}),
  };

  // La privata di licenza vive solo qui: usata per firmare il payload,
  // scartata subito dopo. Non viene mai scritta a DB né loggata.
  const { pubblica: chiavePubblicaLicenza, privata: privataLicenza } = generaCoppiaChiavi();
  const privataMaster = decifraChiavePrivata(prodotto.chiavePrivataMasterCifrata);
  const certificato = certificaChiaveLicenza(chiavePubblicaLicenza, privataMaster);
  const firma = firmaPayload(payload, privataLicenza);

  await prisma.licenzaProdotto.update({
    where: { id },
    data: {
      chiavePubblicaLicenza,
      certificatoLicenza: certificato,
      fileLicenzaGeneratoIl: new Date(),
    },
  });
  await invalidate();

  const file: FileLicenza = { versione: 1, payload, chiavePubblicaLicenza, certificato, firma };

  const nomeFile = `licenza-${licenza.cliente.ragioneSociale}-${prodotto.nome}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return new NextResponse(JSON.stringify(file, null, 2), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${nomeFile}.json"`,
    },
  });
}
