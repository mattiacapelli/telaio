import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Revoca una API key. Non la cancella: resta lo storico di chi l'ha avuta. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const k = await prisma.apiKey.findUnique({ where: { id } });
  if (!k) {
    return NextResponse.json({ errore: "chiave inesistente" }, { status: 404 });
  }

  await prisma.apiKey.update({ where: { id }, data: { revocataIl: new Date() } });
  return NextResponse.json({ ok: true });
}
