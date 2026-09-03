import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { generaFatturaCanone } from "@/lib/contratti";

export const dynamic = "force-dynamic";

/** Genera la fattura del canone per il periodo corrente (bottone "Fattura canone"). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const esito = await generaFatturaCanone(id);
  if (!esito.ok) {
    const status = esito.codice === "NON_TROVATO" ? 404 : esito.codice === "GIA_FATTURATO" ? 409 : 400;
    return NextResponse.json({ errore: esito.messaggio }, { status });
  }

  await invalidate();
  return NextResponse.json(
    { ok: true, id: esito.id, numero: esito.numero, imponibile: esito.imponibile },
    { status: 201 },
  );
}
