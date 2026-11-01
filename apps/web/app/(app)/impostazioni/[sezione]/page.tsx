import {
  apiKeys,
  asc,
  clientiRef,
  conti,
  desc,
  eq,
  getDb,
  impostazioni,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
  sql,
  webhookDeliveries,
  webhooks,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/lib/auth";
import { SEZIONI_IMPOSTAZIONI } from "@/lib/nav";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SezioneApi } from "../_sezioni/api";
import { SezioneDati } from "../_sezioni/dati";
import { SezioneIva } from "../_sezioni/iva";
import { SezioneListini } from "../_sezioni/listini";
import { SezioneMcp } from "../_sezioni/mcp";
import { SezioneRagioniSociali } from "../_sezioni/ragioni-sociali";
import { SezioneSicurezza } from "../_sezioni/sicurezza";
import { SezioneTwenty } from "../_sezioni/twenty";

export const dynamic = "force-dynamic";

const DESCRIZIONI: Record<string, string> = {
  "ragioni-sociali": "Gli emittenti di preventivi e fatture, con la loro numerazione.",
  iva: "Regole IVA, bollo, ritenuta e split payment per ragione sociale.",
  listini: "Basi, moduli aggiuntivi, prezzi netti e compatibilità.",
  mcp: "Server MCP per gli assistenti AI: strumenti attivi e conferma delle scritture.",
  api: "Chiavi API, permessi e webhook in uscita.",
  twenty: "Stato del collegamento al CRM e sincronizzazione dei clienti.",
  sicurezza: "Profilo, password, verifica in due passaggi, passkey e dispositivi connessi.",
  dati: "Backup automatico del database ed export dei dati contabili.",
};

const STUB: Record<string, string> = {
  "fatturazione-elettronica":
    "L'invio passa da un intermediario: l'interfaccia del servizio è definita, il collegamento si implementa dopo.",
  "modelli-pdf": "Modelli di preventivo e fattura in PDF, per ragione sociale.",
  email: "Mittenti e modelli per l'invio di preventivi, fatture e solleciti.",

  pagamenti: "Collegamento a Stripe per gli incassi con carta.",
};

export async function generateMetadata({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  return { title: SEZIONI_IMPOSTAZIONI.find((s) => s.slug === sezione)?.titolo ?? "Impostazioni" };
}

export default async function SezionePage({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  const voce = SEZIONI_IMPOSTAZIONI.find((s) => s.slug === sezione);
  if (!voce) notFound();
  const db = getDb();

  let contenuto: React.ReactNode;
  if (sezione === "ragioni-sociali" || sezione === "iva" || sezione === "listini") {
    const ragioni = await db
      .select()
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt))
      .orderBy(asc(ragioniSociali.createdAt));
    if (sezione === "ragioni-sociali") contenuto = <SezioneRagioniSociali elenco={ragioni} />;
    else if (sezione === "iva")
      contenuto = (
        <SezioneIva
          elenco={ragioni}
          conti={await db.select().from(conti).where(isNull(conti.deletedAt))}
        />
      );
    else {
      const [l, b, m, a] = await Promise.all([
        db.select().from(listini).where(isNull(listini.deletedAt)).orderBy(asc(listini.createdAt)),
        db
          .select()
          .from(listinoBasi)
          .where(isNull(listinoBasi.deletedAt))
          .orderBy(asc(listinoBasi.ordine)),
        db
          .select()
          .from(listinoModuli)
          .where(isNull(listinoModuli.deletedAt))
          .orderBy(asc(listinoModuli.ordine)),
        db.select().from(moduloBasi),
      ]);
      contenuto = (
        <SezioneListini elenco={l} ragioni={ragioni} basi={b} moduli={m} assegnazioni={a} />
      );
    }
  } else if (sezione === "mcp") {
    const righe = await db.select().from(impostazioni);
    const valore = (chiave: string) =>
      (righe.find((r) => r.chiave === chiave)?.valore ?? {}) as Record<string, boolean>;
    contenuto = (
      <SezioneMcp attivi={valore("mcp.strumenti")} approvazioni={valore("mcp.approvazione")} />
    );
  } else if (sezione === "sicurezza") {
    const [{ user, session }, h] = await Promise.all([requireSession(), headers()]);
    const [passkeys, sessioni] = await Promise.all([
      auth.api.listPasskeys({ headers: h }),
      auth.api.listSessions({ headers: h }),
    ]);
    contenuto = (
      <SezioneSicurezza
        nome={user.name}
        email={user.email}
        dueFattori={!!user.twoFactorEnabled}
        passkey={passkeys.map((p) => ({
          id: p.id,
          nome: p.name ?? null,
          creata: p.createdAt ? new Date(p.createdAt).toISOString() : null,
          sincronizzata: p.backedUp,
        }))}
        sessioni={sessioni.map((x) => ({
          token: x.token,
          agente: x.userAgent ?? null,
          ip: x.ipAddress ?? null,
          creata: new Date(x.createdAt).toISOString(),
          corrente: x.token === session.token,
        }))}
      />
    );
  } else if (sezione === "dati") {
    contenuto = <SezioneDati anno={new Date().getFullYear()} />;
  } else if (sezione === "twenty") {
    const [stat] = await db
      .select({
        n: sql<number>`count(*)::int`,
        ultima: sql<Date | null>`max(${clientiRef.lastSyncedAt})`,
      })
      .from(clientiRef);
    const url = process.env.TWENTY_API_URL;
    contenuto = (
      <SezioneTwenty
        finto={twentyDaEnv().finto}
        host={url ? new URL(url).host : null}
        riferimenti={stat?.n ?? 0}
        ultimaSync={stat?.ultima ? new Date(stat.ultima) : null}
      />
    );
  } else if (sezione === "api") {
    const [chiavi, elencoHook, conteggi] = await Promise.all([
      db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)),
      db.select().from(webhooks).orderBy(desc(webhooks.createdAt)),
      db
        .select({
          webhookId: webhookDeliveries.webhookId,
          stato: webhookDeliveries.stato,
          n: sql<number>`count(*)::int`,
        })
        .from(webhookDeliveries)
        .groupBy(webhookDeliveries.webhookId, webhookDeliveries.stato),
    ]);
    const n = (id: string, stato: string) =>
      conteggi.find((c) => c.webhookId === id && c.stato === stato)?.n ?? 0;
    contenuto = (
      <SezioneApi
        chiavi={chiavi}
        hook={elencoHook.map((w) => ({
          w,
          consegnati: n(w.id, "consegnato"),
          inAttesa: n(w.id, "in_attesa"),
          falliti: n(w.id, "fallito"),
        }))}
      />
    );
  } else {
    return (
      <Guscio
        sezione={sezione}
        titolo={voce.titolo}
        gruppo={voce.gruppo}
        descrizione={STUB[sezione] ?? ""}
      >
        <Card>
          <h2 className="text-base font-semibold">Sezione in arrivo</h2>
          <p className="mt-1 max-w-prose text-sm text-fg-2">
            La struttura è pronta: mancano le opzioni di questa sezione.
          </p>
        </Card>
      </Guscio>
    );
  }

  return (
    <Guscio
      sezione={sezione}
      titolo={voce.titolo}
      gruppo={voce.gruppo}
      descrizione={DESCRIZIONI[sezione] ?? ""}
    >
      {contenuto}
    </Guscio>
  );
}

/** Cornice delle impostazioni: menu delle sezioni a sinistra, contenuto a destra. */
function Guscio({
  sezione,
  titolo,
  descrizione,
  children,
}: {
  sezione: string;
  titolo: string;
  gruppo?: string;
  descrizione: string;
  children: React.ReactNode;
}) {
  const gruppi = [...new Set(SEZIONI_IMPOSTAZIONI.map((s) => s.gruppo))];
  return (
    <>
      <PageHeader titolo={titolo} descrizione={descrizione || undefined} />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav
          aria-label="Sezioni delle impostazioni"
          className="flex shrink-0 flex-col gap-3 md:sticky md:top-4 md:w-52"
        >
          {gruppi.map((g) => (
            <div key={g} className="flex flex-col gap-0.5">
              <p className="px-2 pb-0.5 text-xs font-medium text-fg-3">{g}</p>
              {SEZIONI_IMPOSTAZIONI.filter((s) => s.gruppo === g).map((s) => (
                <Link
                  key={s.slug}
                  href={`/impostazioni/${s.slug}`}
                  aria-current={s.slug === sezione ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center rounded-md px-2 text-sm transition-colors duration-150",
                    s.slug === sezione
                      ? "bg-hover font-medium text-fg"
                      : "text-fg-2 hover:bg-hover hover:text-fg",
                  )}
                >
                  {s.titolo}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      </div>
    </>
  );
}
