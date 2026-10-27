import {
  apiKeys,
  asc,
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
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { SEZIONI_IMPOSTAZIONI } from "@/lib/nav";
import { cn, st } from "@/lib/utils";
import { SezioneApi } from "../_sezioni/api";
import { SezioneIva } from "../_sezioni/iva";
import { SezioneListini } from "../_sezioni/listini";
import { SezioneMcp } from "../_sezioni/mcp";
import { SezioneRagioniSociali } from "../_sezioni/ragioni-sociali";

export const dynamic = "force-dynamic";

const DESCRIZIONI: Record<string, string> = {
  "ragioni-sociali": "Gli emittenti di preventivi e fatture, con la loro numerazione.",
  iva: "Regole IVA, bollo, ritenuta e split payment per ragione sociale.",
  listini: "Basi, moduli aggiuntivi, prezzi netti e compatibilità.",
  mcp: "Server MCP per gli assistenti AI: strumenti attivi e conferma delle scritture.",
  api: "Chiavi API, permessi e webhook in uscita.",
};

const STUB: Record<string, string> = {
  "fatturazione-elettronica":
    "L'invio passa da un intermediario: l'interfaccia del servizio è definita, il collegamento si implementa dopo.",
  "modelli-pdf": "Modelli di preventivo e fattura in PDF, per ragione sociale.",
  email: "Mittenti e modelli per l'invio di preventivi, fatture e solleciti.",
  twenty:
    "Collegamento a Twenty CRM: oggi si configura con TWENTY_API_URL e TWENTY_API_KEY nel file .env.",
  pagamenti: "Collegamento a Stripe per gli incassi con carta.",
  sicurezza: "Profilo, password, passkey e autenticazione a due fattori (TOTP).",
  dati: "Backup del database ed export dei dati.",
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
    const [riga] = await db
      .select()
      .from(impostazioni)
      .where(eq(impostazioni.chiave, "mcp.strumenti"));
    contenuto = <SezioneMcp attivi={(riga?.valore ?? {}) as Record<string, boolean>} />;
  } else if (sezione === "api") {
    contenuto = (
      <SezioneApi chiavi={await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt))} />
    );
  } else {
    return (
      <Guscio
        sezione={sezione}
        titolo={voce.titolo}
        gruppo={voce.gruppo}
        descrizione={STUB[sezione] ?? ""}
      >
        <div
          className="card"
          style={st("display:flex;flex-direction:column;gap:8px;align-items:flex-start")}
        >
          <h2 className="h2">Sezione in arrivo</h2>
          <p style={st("margin:0;font-size:14px;line-height:1.6;color:#3a372f;max-width:62ch")}>
            La struttura è pronta: mancano le opzioni di questa sezione.
          </p>
        </div>
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
  gruppo,
  descrizione,
  children,
}: {
  sezione: string;
  titolo: string;
  gruppo: string;
  descrizione: string;
  children: React.ReactNode;
}) {
  const gruppi = [...new Set(SEZIONI_IMPOSTAZIONI.map((s) => s.gruppo))];
  return (
    <>
      <TopBar placeholder="Cerca un'impostazione…" />
      <section style={st("display:flex;flex-direction:column;gap:14px")}>
        <span className="eb">14 — Impostazioni · {gruppo}</span>
        <h1
          className="d"
          style={st(
            "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
          )}
        >
          {titolo}
        </h1>
      </section>
      <div style={st("display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start")}>
        <nav
          aria-label="Sezioni delle impostazioni"
          className="card"
          style={st("flex:0 0 220px;display:flex;flex-direction:column;padding:10px")}
        >
          {gruppi.map((g) => (
            <div key={g} style={st("display:flex;flex-direction:column")}>
              <span className="sng">{g}</span>
              {SEZIONI_IMPOSTAZIONI.filter((s) => s.gruppo === g).map((s) => (
                <Link
                  key={s.slug}
                  href={`/impostazioni/${s.slug}`}
                  aria-current={s.slug === sezione ? "page" : undefined}
                  className={cn("sn", s.slug === sezione && "on")}
                >
                  {s.titolo}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div style={st("flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:20px")}>
          {descrizione && <p className="lead">{descrizione}</p>}
          {children}
        </div>
      </div>
    </>
  );
}
