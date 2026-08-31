import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { elencoCestino, type Entita } from "@/lib/eliminazione";

export const dynamic = "force-dynamic";

const ENTITA_VALIDE: Entita[] = [
  "cliente", "preventivo", "progetto", "attivita", "ticket", "fattura",
  "contratto", "costo", "registrazioneOre", "documento", "workflow",
  "modelloPdf", "testoStandard", "webhook", "contoIncasso", "prodotto", "licenzaProdotto",
];

/** Elenco del cestino per un'entità: cosa c'è dentro, in attesa di ripristino o eliminazione definitiva. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entita: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { entita } = await params;
  if (!ENTITA_VALIDE.includes(entita as Entita)) {
    return NextResponse.json({ errore: "entità sconosciuta" }, { status: 400 });
  }

  const elementi = await elencoCestino(entita as Entita);
  return NextResponse.json(elementi);
}
