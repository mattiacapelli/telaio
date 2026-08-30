import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { urlDownload, eliminaFile } from "@/lib/storage";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** Reindirizza a un URL firmato temporaneo per scaricare il file. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ errore: "documento inesistente" }, { status: 404 });
  }

  try {
    return NextResponse.redirect(await urlDownload(doc.chiave, doc.nome));
  } catch {
    return NextResponse.json({ errore: "storage non raggiungibile" }, { status: 502 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ errore: "documento inesistente" }, { status: 404 });
  }

  // Prima il file, poi la riga: se lo storage fallisce non restiamo con un
  // record che punta al nulla.
  try {
    await eliminaFile(doc.chiave);
  } catch {
    /* il file potrebbe già non esserci: procediamo comunque */
  }
  await prisma.documento.delete({ where: { id } });

  await invalidate();
  return NextResponse.json({ ok: true });
}
