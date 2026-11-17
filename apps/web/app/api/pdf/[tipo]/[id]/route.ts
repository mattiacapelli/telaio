import { generaPdf, generaPdfOre } from "@telaio/core";
import { datiPdfFattura, datiPdfOre, datiPdfPreventivo, getDb, leggiModelloPdf } from "@telaio/db";
import { oggi } from "@/lib/date";
import { rispostaPdf } from "@/lib/pdf-risposta";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** PDF di un preventivo, di una fattura o dell'estratto ore di un contratto: /api/pdf/preventivi/<id>, /api/pdf/fatture/<id>, /api/pdf/ore/<id>[?ciclo=N] (con ?inline=1 si apre nel browser). */
export async function GET(
  richiesta: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  if (!(await getSession())) return new Response("Non autorizzato", { status: 401 });
  const { tipo, id } = await params;
  if (
    (tipo !== "preventivi" && tipo !== "fatture" && tipo !== "ore") ||
    !/^[0-9a-f-]{36}$/.test(id)
  )
    return new Response("Non trovato", { status: 404 });
  const db = getDb();
  const url = new URL(richiesta.url);
  if (tipo === "ore") {
    // estratto ore di un contratto: ?ciclo=N sceglie il periodo (senza, quello in corso)
    const grezzo = url.searchParams.get("ciclo");
    const ciclo = grezzo === null ? undefined : Number(grezzo);
    if (ciclo !== undefined && (!Number.isInteger(ciclo) || ciclo < 0))
      return new Response("Non trovato", { status: 404 });
    const estratto = await datiPdfOre(db, id, oggi(), ciclo);
    if (!estratto) return new Response("Non trovato", { status: 404 });
    const pdf = await generaPdfOre(
      estratto.dati,
      await leggiModelloPdf(db, estratto.ragioneSocialeId),
    );
    return rispostaPdf(pdf, estratto.nomeFile, url.searchParams.get("inline") === "1");
  }
  const doc =
    tipo === "preventivi" ? await datiPdfPreventivo(db, id) : await datiPdfFattura(db, id);
  if (!doc) return new Response("Non trovato", { status: 404 });
  const pdf = await generaPdf(doc.dati, await leggiModelloPdf(db, doc.ragioneSocialeId));
  return rispostaPdf(pdf, doc.nomeFile, url.searchParams.get("inline") === "1");
}
