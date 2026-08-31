import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Ultime consegne di un webhook, per capire se sta funzionando davvero. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const registro = await prisma.registroWebhook.findMany({
    where: { webhookId: id },
    orderBy: { inviataIl: "desc" },
    take: 20,
  });
  return NextResponse.json(registro);
}
