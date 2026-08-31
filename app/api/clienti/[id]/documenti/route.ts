import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { caricaFile } from "@/lib/storage";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const MAX_BYTE = 25 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const esiste = await prisma.cliente.findUnique({ where: { id }, select: { id: true } });
  if (!esiste) {
    return NextResponse.json({ errore: "record inesistente" }, { status: 404 });
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

  const chiave = `clienti/${id}/${randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await caricaFile(chiave, buffer, file.type || "application/octet-stream");
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      { errore: `storage non raggiungibile: ${messaggio}` },
      { status: 502 },
    );
  }

  const doc = await prisma.documento.create({
    data: {
      clienteId: id,
      nome: file.name,
      chiave,
      tipo: file.type || "application/octet-stream",
      dimensione: file.size,
      caricatoDa: sessione.email,
    },
    select: { id: true, nome: true, dimensione: true },
  });

  await invalidate();
  return NextResponse.json({ ok: true, ...doc }, { status: 201 });
}
