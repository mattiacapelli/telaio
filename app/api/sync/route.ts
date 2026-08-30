import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { syncFromTwenty, twentyConfigured } from "@/lib/twenty";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  return NextResponse.json({ configurato: twentyConfigured() });
}

export async function POST() {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  try {
    const esito = await syncFromTwenty();
    return NextResponse.json({ ok: true, ...esito });
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json({ ok: false, errore: messaggio }, { status: 500 });
  }
}
