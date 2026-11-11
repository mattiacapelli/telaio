import { fileInArchivio, getDb } from "@telaio/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** I file già nell'archivio, per allegarli ad altro senza ricaricarli. `?q=` cerca per nome. */
export async function GET(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ errore: "Accesso richiesto" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const file = await fileInArchivio(getDb(), { testo: q, limite: 40 });
  return NextResponse.json(file);
}
