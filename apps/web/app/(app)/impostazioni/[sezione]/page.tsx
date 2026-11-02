import { decodificaLogo } from "@telaio/core";
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
  leggiEmail,
  leggiModelliPdfSalvati,
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
import { ScorriVersoAttivo } from "@/components/ui/scorri-verso-attivo";
import { auth, passwordMinima } from "@/lib/auth";
import { statoSmtp } from "@/lib/email";
import { SEZIONI_DISATTIVATE, SEZIONI_IMPOSTAZIONI } from "@/lib/nav";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SezioneApi } from "../_sezioni/api";
import { SezioneDati } from "../_sezioni/dati";
import { SezioneEmail } from "../_sezioni/email";
import { SezioneIva } from "../_sezioni/iva";
import { SezioneListini } from "../_sezioni/listini";
import { SezioneMcp } from "../_sezioni/mcp";
import { SezioneModelliPdf } from "../_sezioni/modelli-pdf";
import { SezioneRagioniSociali } from "../_sezioni/ragioni-sociali";
import { SezioneSicurezza } from "../_sezioni/sicurezza";
import { SezioneTwenty } from "../_sezioni/twenty";

export const dynamic = "force-dynamic";

const DESCRIZIONI: Record<string, string> = {
  "ragioni-sociali": "Gli emittenti di preventivi e fatture, con la loro numerazione.",
  iva: "Regole IVA, bollo, ritenuta e split payment per ragione sociale.",
  listini: "Basi, moduli aggiuntivi, prezzi netti e compatibilità.",
  email: "Mittenti, firma e prova dell'invio delle email.",
  "modelli-pdf": "Aspetto e testi dei PDF di preventivi e fatture, per ragione sociale.",
  mcp: "Server MCP per gli assistenti AI: strumenti attivi e conferma delle scritture.",
  api: "Chiavi API, permessi e webhook in uscita.",
  twenty: "Stato del collegamento al CRM e sincronizzazione dei clienti.",
  sicurezza: "Profilo, password, verifica in due passaggi, passkey e dispositivi connessi.",
  dati: "Backup automatico del database ed export dei dati contabili.",
};

export async function generateMetadata({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  return { title: SEZIONI_IMPOSTAZIONI.find((s) => s.slug === sezione)?.titolo ?? "Impostazioni" };
}

export default async function SezionePage({ params }: { params: Promise<{ sezione: string }> }) {
  const { sezione } = await params;
  const voce = SEZIONI_IMPOSTAZIONI.find((s) => s.slug === sezione);
  if (!voce || SEZIONI_DISATTIVATE.includes(sezione)) notFound();
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
  } else if (sezione === "email" || sezione === "modelli-pdf") {
    const ragioni = await db
      .select()
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt))
      .orderBy(asc(ragioniSociali.createdAt));
    if (sezione === "email") {
      const { user } = await requireSession();
      contenuto = (
        <SezioneEmail
          elenco={ragioni}
          impostazioni={await leggiEmail(db)}
          smtp={statoSmtp()}
          emailUtente={user.email}
        />
      );
    } else {
      const [riga] = await db
        .select()
        .from(impostazioni)
        .where(eq(impostazioni.chiave, "azienda.logo"));
      const logo = (riga?.valore as { dataUrl?: string } | undefined)?.dataUrl;
      contenuto = (
        <SezioneModelliPdf
          elenco={ragioni}
          modelli={await leggiModelliPdfSalvati(db)}
          logoIniziale={logo && decodificaLogo(logo) ? logo : null}
        />
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
        passwordMinima={await passwordMinima()}
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
    notFound();
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
        <ScorriVersoAttivo
          role="navigation"
          aria-label="Sezioni delle impostazioni"
          className="flex shrink-0 flex-col gap-3 max-md:-mx-4 max-md:flex-row max-md:gap-1.5 max-md:overflow-x-auto max-md:px-4 md:sticky md:top-4 md:w-56"
        >
          {gruppi.map((g) => (
            <div key={g} className="flex flex-col gap-0.5 max-md:contents">
              <p className="px-2 pb-0.5 text-xs font-medium text-fg-3 max-md:hidden">{g}</p>
              {SEZIONI_IMPOSTAZIONI.filter((s) => s.gruppo === g).map((s) =>
                SEZIONI_DISATTIVATE.includes(s.slug) ? (
                  <span
                    key={s.slug}
                    aria-disabled="true"
                    title="Non ancora disponibile"
                    className="flex h-8 cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 text-sm whitespace-nowrap text-fg-3 max-md:h-[38px] max-md:shrink-0 max-md:rounded-full max-md:border max-md:border-dashed max-md:border-line max-md:px-3"
                  >
                    {s.titolo}
                    <span className="rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] font-medium">
                      Presto
                    </span>
                  </span>
                ) : (
                  <Link
                    key={s.slug}
                    href={`/impostazioni/${s.slug}`}
                    aria-current={s.slug === sezione ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center rounded-md px-2 text-sm whitespace-nowrap transition-colors duration-150 max-md:h-[38px] max-md:shrink-0 max-md:rounded-full max-md:border max-md:border-line max-md:px-3",
                      s.slug === sezione
                        ? "bg-hover font-medium text-fg max-md:border-transparent max-md:bg-fg max-md:text-on-fg"
                        : "text-fg-2 hover:bg-hover hover:text-fg",
                    )}
                  >
                    {s.titolo}
                  </Link>
                ),
              )}
            </div>
          ))}
        </ScorriVersoAttivo>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      </div>
    </>
  );
}
