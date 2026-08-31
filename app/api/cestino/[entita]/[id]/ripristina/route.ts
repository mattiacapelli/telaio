import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { ripristinaDalCestino, ErroreEliminazione, type Entita } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const ENTITA_VALIDE: Entita[] = [
  "cliente", "preventivo", "progetto", "attivita", "ticket", "fattura",
  "contratto", "costo", "registrazioneOre", "documento", "workflow",
  "modelloPdf", "testoStandard", "webhook",
];

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ entita: string; id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { entita, id } = await params;
  if (!ENTITA_VALIDE.includes(entita as Entita)) {
    return NextResponse.json({ errore: "entità sconosciuta" }, { status: 400 });
  }

  try {
    await ripristinaDalCestino(entita as Entita, id);
  } catch (err) {
    if (err instanceof ErroreEliminazione) {
      return NextResponse.json({ errore: err.message }, { status: 409 });
    }
    throw err;
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}
