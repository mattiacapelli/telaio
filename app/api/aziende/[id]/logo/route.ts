import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { caricaFile, eliminaFile } from "@/lib/storage";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const MAX_BYTE = 2 * 1024 * 1024;
// PDFKit disegna solo raster: un SVG verrebbe accettato qui ma non
// comparirebbe mai nel PDF, un difetto silenzioso peggiore del rifiuto.
const TIPI_AMMESSI = ["image/png", "image/jpeg"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const azienda = await prisma.azienda.findUnique({ where: { id } });
  if (!azienda) {
    return NextResponse.json({ errore: "azienda inesistente" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ errore: "nessun file ricevuto" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ errore: "il file è vuoto" }, { status: 400 });
  }
  if (file.size > MAX_BYTE) {
    return NextResponse.json(
      { errore: `il file supera i ${MAX_BYTE / 1024 / 1024} MB` },
      { status: 413 },
    );
  }
  if (!TIPI_AMMESSI.includes(file.type)) {
    return NextResponse.json({ errore: "usa un PNG o JPEG" }, { status: 415 });
  }

  const chiave = `azienda/${id}/logo-${randomUUID()}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await caricaFile(chiave, buffer, file.type);
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      { errore: `storage non raggiungibile: ${messaggio}` },
      { status: 502 },
    );
  }

  const vecchia = azienda.logoChiave;
  await prisma.azienda.update({ where: { id }, data: { logoChiave: chiave } });
  if (vecchia) await eliminaFile(vecchia).catch(() => {});

  await invalidate();
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const azienda = await prisma.azienda.findUnique({ where: { id } });
  if (!azienda) {
    return NextResponse.json({ errore: "azienda inesistente" }, { status: 404 });
  }
  if (!azienda.logoChiave) {
    return NextResponse.json({ ok: true });
  }

  await prisma.azienda.update({ where: { id }, data: { logoChiave: null } });
  await eliminaFile(azienda.logoChiave).catch(() => {});

  await invalidate();
  return NextResponse.json({ ok: true });
}
