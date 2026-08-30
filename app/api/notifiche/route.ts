import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  const notifiche = await prisma.notifica.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({
    notifiche,
    daLeggere: notifiche.filter((x) => !x.lettaIl).length,
  });
}

/** Segna tutte le notifiche come lette. */
export async function POST() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }
  await prisma.notifica.updateMany({
    where: { lettaIl: null },
    data: { lettaIl: new Date() },
  });
  return NextResponse.json({ ok: true });
}
