import { generaPdf } from "@telaio/core";
import { datiPdfEsempio, getDb, leggiModelloPdf } from "@telaio/db";
import { rispostaPdf } from "@/lib/pdf-risposta";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Anteprima del modello di una ragione sociale con dati di esempio: /api/pdf/anteprima?rs=<id>&tipo=preventivo|fattura */
export async function GET(richiesta: Request) {
  if (!(await getSession())) return new Response("Non autorizzato", { status: 401 });
  const p = new URL(richiesta.url).searchParams;
  const rs = p.get("rs") ?? "";
  const tipo = p.get("tipo");
  if ((tipo !== "preventivo" && tipo !== "fattura") || !/^[0-9a-f-]{36}$/.test(rs))
    return new Response("Richiesta non valida", { status: 400 });
  const db = getDb();
  const doc = await datiPdfEsempio(db, rs, tipo);
  if (!doc) return new Response("Non trovato", { status: 404 });
  const pdf = await generaPdf(doc.dati, await leggiModelloPdf(db, rs));
  return rispostaPdf(pdf, doc.nomeFile, true);
}
