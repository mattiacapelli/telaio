import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { CATALOGO_EVENTI } from "@/lib/webhook";

export const dynamic = "force-dynamic";

const CHIAVI_EVENTO = CATALOGO_EVENTI.map((e) => e.chiave) as [string, ...string[]];

const Modifica = z.object({
  nome: z.string().min(1).optional(),
  url: z.string().url().optional(),
  eventi: z.array(z.enum(["*", ...CHIAVI_EVENTO])).min(1).optional(),
  attivo: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Modifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }

  const w = await prisma.webhook.findUnique({ where: { id } });
  if (!w) {
    return NextResponse.json({ errore: "webhook inesistente" }, { status: 404 });
  }

  await prisma.webhook.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
