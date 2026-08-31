import { NextResponse } from "next/server";
import { z } from "zod";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import {
  spostaNelCestino,
  eliminaDefinitivamente,
  ErroreEliminazione,
  type Entita,
} from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const ENTITA_VALIDE: Entita[] = [
  "cliente", "preventivo", "progetto", "attivita", "ticket", "fattura",
  "contratto", "costo", "registrazioneOre", "documento", "workflow",
  "modelloPdf", "testoStandard", "webhook",
];

function entitaValida(v: string): v is Entita {
  return ENTITA_VALIDE.includes(v as Entita);
}

/** Sposta un record nel cestino (soft delete). Rifiutato se ha figli non eliminati. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entita: string; id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { entita, id } = await params;
  if (!entitaValida(entita)) {
    return NextResponse.json({ errore: "entità sconosciuta" }, { status: 400 });
  }

  try {
    await spostaNelCestino(entita, id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}

const Conferma = z.object({ conferma: z.string().min(1, "conferma obbligatoria") });

/**
 * Elimina un record per sempre. Il body deve contenere `conferma` uguale
 * esattamente al nome del record: la stessa frizione di GitHub per non
 * rendere un'azione irreversibile un click distratto.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ entita: string; id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { entita, id } = await params;
  if (!entitaValida(entita)) {
    return NextResponse.json({ errore: "entità sconosciuta" }, { status: 400 });
  }

  const parsed = Conferma.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "conferma mancante" },
      { status: 400 },
    );
  }

  try {
    await eliminaDefinitivamente(entita, id, parsed.data.conferma);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
