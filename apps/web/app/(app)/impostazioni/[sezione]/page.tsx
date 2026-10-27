import { apiKeys, asc, conti, desc, getDb, impostazioni, isNull, listinoBasi, listinoModuli, listini, moduloBasi, ragioniSociali, eq } from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/domain/stub-page";
import { PageHeader } from "@/components/ui/page-header";
import { SEZIONI_IMPOSTAZIONI } from "@/lib/nav";
import { cn } from "@/lib/utils";
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
  "fatturazione-elettronica": "L'invio passa da un intermediario: l'interfaccia del servizio è definita, il collegamento si implementa dopo.",
  "modelli-pdf": "Modelli di preventivo e fattura in PDF, per ragione sociale.",
  email: "Mittenti e modelli per l'invio di preventivi, fatture e solleciti.",
  twenty: "Collegamento a Twenty CRM: oggi si configura con TWENTY_API_URL e TWENTY_API_KEY nel file .env.",
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
    const ragioni = await db.select().from(ragioniSociali).where(isNull(ragioniSociali.deletedAt)).orderBy(asc(ragioniSociali.createdAt));
    if (sezione === "ragioni-sociali") contenuto = <SezioneRagioniSociali elenco={ragioni} />;
    else if (sezione === "iva") contenuto = <SezioneIva elenco={ragioni} conti={await db.select().from(conti).where(isNull(conti.deletedAt))} />;
    else {
      const [l, b, m, a] = await Promise.all([
        db.select().from(listini).where(isNull(listini.deletedAt)).orderBy(asc(listini.createdAt)),
        db.select().from(listinoBasi).where(isNull(listinoBasi.deletedAt)).orderBy(asc(listinoBasi.ordine)),
        db.select().from(listinoModuli).where(isNull(listinoModuli.deletedAt)).orderBy(asc(listinoModuli.ordine)),
        db.select().from(moduloBasi),
      ]);
      contenuto = <SezioneListini elenco={l} ragioni={ragioni} basi={b} moduli={m} assegnazioni={a} />;
    }
  } else if (sezione === "mcp") {
    const [riga] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, "mcp.strumenti"));
    contenuto = <SezioneMcp attivi={(riga?.valore ?? {}) as Record<string, boolean>} />;
  } else if (sezione === "api") {
    contenuto = <SezioneApi chiavi={await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt))} />;
  } else {
    return (
      <>
        <Navigazione sezione={sezione} />
        <StubPage numero="14" sezione="Impostazioni" titolo={voce.titolo} descrizione={STUB[sezione] ?? ""} vuoto={{ titolo: "Sezione in arrivo", testo: "La struttura è pronta: mancano le opzioni di questa sezione." }} />
      </>
    );
  }

  return (
    <>
      <Navigazione sezione={sezione} />
      <PageHeader numero="14" sezione="Impostazioni" titolo={voce.titolo} descrizione={DESCRIZIONI[sezione]} />
      {contenuto}
    </>
  );
}

function Navigazione({ sezione }: { sezione: string }) {
  return (
    <nav aria-label="Sezioni delle impostazioni" className="mb-8 flex flex-wrap gap-2">
      {SEZIONI_IMPOSTAZIONI.map((s) => (
        <Link
          key={s.slug}
          href={`/impostazioni/${s.slug}`}
          aria-current={s.slug === sezione ? "page" : undefined}
          className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm", s.slug === sezione ? "bg-ink text-paper" : "glass-pill text-ink-2 hover:bg-white/80")}
        >
          {s.titolo}
        </Link>
      ))}
    </nav>
  );
}
