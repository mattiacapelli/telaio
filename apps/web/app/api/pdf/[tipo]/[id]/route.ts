import { generaPdf } from "@telaio/core";
import { datiPdfFattura, datiPdfPreventivo, getDb, leggiModelloPdf } from "@telaio/db";
import { rispostaPdf } from "@/lib/pdf-risposta";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** PDF di un preventivo o di una fattura: /api/pdf/preventivi/<id> e /api/pdf/fatture/<id> (con ?inline=1 si apre nel browser). */
export async function GET(
  richiesta: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  if (!(await getSession())) return new Response("Non autorizzato", { status: 401 });
  const { tipo, id } = await params;
  if ((tipo !== "preventivi" && tipo !== "fatture") || !/^[0-9a-f-]{36}$/.test(id))
    return new Response("Non trovato", { status: 404 });
  const db = getDb();
  const doc =
    tipo === "preventivi" ? await datiPdfPreventivo(db, id) : await datiPdfFattura(db, id);
  if (!doc) return new Response("Non trovato", { status: 404 });
  const pdf = await generaPdf(doc.dati, await leggiModelloPdf(db, doc.ragioneSocialeId));
  return rispostaPdf(pdf, doc.nomeFile, new URL(richiesta.url).searchParams.get("inline") === "1");
}
