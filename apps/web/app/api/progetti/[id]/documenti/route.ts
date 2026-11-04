import { randomUUID } from "node:crypto";
import { chiaveOggetto, LIMITE_FILE_BYTE, nomeFileSicuro } from "@telaio/core";
import { getDb, registraDocumento } from "@telaio/db";
import { NextResponse } from "next/server";
import { stessaOrigine } from "@/lib/archivio/richiesta";
import { archivioPronto, caricaOggetto, eliminaOggetto, messaggioErrore } from "@/lib/archivio/s3";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_FILE_PER_RICHIESTA = 10;

/**
 * Carica uno o più file nel bucket e li registra nel progetto. Campi: `file` (ripetibile),
 * `categoria`, `descrizione`, `ticketId`. Risponde con i file caricati e, per ognuno che non è
 * andato a buon fine, il motivo: un file sbagliato non blocca gli altri.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 });
  if (!stessaOrigine(request))
    return NextResponse.json({ errore: "Richiesta non valida" }, { status: 403 });
  const { id: progettoId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(progettoId))
    return NextResponse.json({ errore: "Progetto non valido" }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ errore: "Caricamento non valido" }, { status: 400 });
  }
  const file = form.getAll("file").filter((f): f is File => f instanceof File && f.size >= 0);
  if (file.length === 0)
    return NextResponse.json({ errore: "Scegli almeno un file" }, { status: 400 });
  if (file.length > MAX_FILE_PER_RICHIESTA)
    return NextResponse.json(
      { errore: `Al massimo ${MAX_FILE_PER_RICHIESTA} file per volta` },
      { status: 400 },
    );
  const ticketId = String(form.get("ticketId") ?? "") || null;
  const categoria = String(form.get("categoria") ?? "");
  const descrizione = String(form.get("descrizione") ?? "");

  const db = getDb();
  let archivio: Awaited<ReturnType<typeof archivioPronto>>;
  try {
    archivio = await archivioPronto(db);
  } catch (e) {
    return NextResponse.json({ errore: messaggioErrore(e) }, { status: 409 });
  }

  const caricati: { id: string; nome: string }[] = [];
  const errori: { nome: string; errore: string }[] = [];
  for (const f of file) {
    const nome = nomeFileSicuro(f.name);
    if (f.size === 0) {
      errori.push({ nome, errore: "Il file è vuoto" });
      continue;
    }
    if (f.size > LIMITE_FILE_BYTE) {
      errori.push({ nome, errore: `Supera il limite di ${LIMITE_FILE_BYTE / 1024 / 1024} MB` });
      continue;
    }
    const documentoId = randomUUID();
    const chiave = chiaveOggetto({
      prefisso: archivio.config.prefisso,
      progettoId,
      documentoId,
      nome,
    });
    const tipoMime = f.type || "application/octet-stream";
    try {
      await caricaOggetto(archivio, chiave, Buffer.from(await f.arrayBuffer()), tipoMime);
    } catch (e) {
      errori.push({ nome, errore: messaggioErrore(e) });
      continue;
    }
    try {
      await registraDocumento(db, {
        id: documentoId,
        progettoId,
        ticketId,
        nome,
        chiave,
        dimensioneByte: f.size,
        tipoMime,
        categoria,
        descrizione,
        caricatoDaId: session.user.id,
      });
    } catch (e) {
      // Il file è nel bucket ma non nel database: lo si toglie, per non lasciare file senza padrone.
      await eliminaOggetto(archivio, chiave).catch(() => {});
      errori.push({ nome, errore: e instanceof Error ? e.message : "Registrazione non riuscita" });
      continue;
    }
    await audit(db, {
      userId: session.user.id,
      azione: "documento.caricato",
      entita: "progetto_documenti",
      entitaId: documentoId,
      dettagli: { progettoId, nome, dimensioneByte: f.size, ticketId },
    });
    caricati.push({ id: documentoId, nome });
  }
  return NextResponse.json({ caricati, errori }, { status: caricati.length ? 200 : 422 });
}
