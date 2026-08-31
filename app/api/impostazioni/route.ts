import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  tariffaListino: z.coerce.number().nonnegative().optional(),
  terminiPagamento: z.coerce.number().int().nonnegative().optional(),
  modalitaTrasferta: z.enum(["CHILOMETRICA", "PIE_DI_LISTA", "FORFETTARIA"]).optional(),
  tariffaChilometrica: z.coerce.number().nonnegative().optional(),
  forfaitTrasferta: z.coerce.number().nonnegative().optional(),
  twentyFrequenza: z.coerce.number().int().positive().optional(),
  sogliaBollo: z.coerce.number().nonnegative().optional(),
  importoBollo: z.coerce.number().nonnegative().optional(),
});

/**
 * Modifica le preferenze dello studio (tariffe, trasferte, bollo, Twenty).
 *
 * I dati anagrafici dell'emittente (ragione sociale, P.IVA...) vivono in
 * Azienda, non qui: uno studio può fatturare da più ragioni sociali.
 */
export async function PATCH(req: Request) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const parsed = Modifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }

  await prisma.impostazioni.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  await invalidate();
  return NextResponse.json({ ok: true });
}
