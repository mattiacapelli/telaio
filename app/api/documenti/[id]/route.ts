import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { urlDownload } from "@/lib/storage";
import { invalidate } from "@/lib/redis";
import { spostaNelCestino, ErroreEliminazione } from "@/lib/eliminazione";

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

  // Il file resta su S3 finché non si elimina per sempre dal cestino: un
  // soft delete recuperabile non deve poter perdere il binario nel frattempo.
  try {
    await spostaNelCestino("documento", id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
