import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Aggiorna = z.object({
  nome: z.string().min(1).optional(),
  descrizione: z.string().optional().nullable(),
  prezzoListino: z.coerce.number().nonnegative().optional().nullable(),
  progettoId: z.string().optional().nullable(),
  modalitaLicenza: z.enum(["NESSUNA", "ONLINE", "OFFLINE", "ENTRAMBE"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Aggiorna.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const p = await prisma.prodotto.findUnique({ where: { id } });
  if (!p) {
    return NextResponse.json({ errore: "prodotto inesistente" }, { status: 404 });
  }

  await prisma.prodotto.update({
    where: { id },
    data: {
      ...(d.nome !== undefined ? { nome: d.nome } : {}),
      ...(d.descrizione !== undefined ? { descrizione: d.descrizione || null } : {}),
      ...(d.prezzoListino !== undefined ? { prezzoListino: d.prezzoListino } : {}),
      ...(d.progettoId !== undefined ? { progettoId: d.progettoId || null } : {}),
      ...(d.modalitaLicenza !== undefined ? { modalitaLicenza: d.modalitaLicenza } : {}),
    },
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}
