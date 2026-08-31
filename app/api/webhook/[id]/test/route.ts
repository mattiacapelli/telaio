import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { firmaPayload, type PayloadWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/** Invia un payload di prova, per verificare che l'endpoint remoto risponda. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await leggiSessione())) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const w = await prisma.webhook.findUnique({ where: { id } });
  if (!w) {
    return NextResponse.json({ errore: "webhook inesistente" }, { status: 404 });
  }

  const payload: PayloadWebhook = {
    evento: "webhook.test",
    entita: "test",
    dati: { messaggio: "Chiamata di prova da Telaio" },
    inviataIl: new Date().toISOString(),
  };
  const corpo = JSON.stringify(payload);

  let statusHttp: number | null = null;
  let successo = false;
  let errore: string | null = null;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(w.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telaio-Signature": firmaPayload(corpo, w.secret),
        "X-Telaio-Event": "webhook.test",
      },
      body: corpo,
      signal: controller.signal,
    });
    clearTimeout(t);
    statusHttp = r.status;
    successo = r.ok;
    if (!r.ok) errore = `risposta ${r.status}`;
  } catch (e) {
    errore = e instanceof Error ? e.message : "endpoint non raggiungibile";
  }

  await prisma.registroWebhook.create({
    data: { webhookId: id, evento: "webhook.test", payload: JSON.parse(corpo), successo, statusHttp, errore },
  });

  return NextResponse.json({ ok: successo, statusHttp, errore });
}
