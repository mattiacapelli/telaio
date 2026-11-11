import { documentoPerId, getDb } from "@telaio/db";
import { NextResponse } from "next/server";
import { ANTEPRIMA_SICURA, intestazioneAllegato } from "@/lib/archivio/richiesta";
import { archivioPronto, leggiOggetto, messaggioErrore } from "@/lib/archivio/s3";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Scarica un documento passando dal server: il bucket non è mai esposto e l'accesso richiede la
 * sessione. Sempre come allegato; con `?anteprima=1` solo PDF e immagini si aprono nel browser.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession()))
    return NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return NextResponse.json({ errore: "Non trovato" }, { status: 404 });
  const db = getDb();
  const d = await documentoPerId(db, id);
  if (!d?.chiave || d.dimensioneByte === null)
    return NextResponse.json({ errore: "Documento non trovato" }, { status: 404 });

  try {
    const archivio = await archivioPronto(db);
    const { corpo, lunghezza } = await leggiOggetto(archivio, d.chiave);
    const anteprima =
      new URL(request.url).searchParams.get("anteprima") === "1" &&
      ANTEPRIMA_SICURA.test(d.tipoMime);
    return new Response(corpo, {
      headers: {
        "Content-Type": anteprima ? d.tipoMime : "application/octet-stream",
        "Content-Disposition": intestazioneAllegato(d.nome, anteprima),
        "Content-Length": String(lunghezza ?? d.dimensioneByte),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Il visualizzatore PDF del browser non parte in un contesto «sandbox»; il PDF non esegue script della pagina.
        ...(d.tipoMime === "application/pdf" && anteprima
          ? {}
          : { "Content-Security-Policy": "sandbox; default-src 'none'" }),
      },
    });
  } catch (e) {
    return NextResponse.json({ errore: messaggioErrore(e) }, { status: 502 });
  }
}
