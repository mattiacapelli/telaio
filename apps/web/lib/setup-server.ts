import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getDb, leggiStatoSetup, sql } from "@telaio/db";
import { cookies, headers } from "next/headers";
import { getRedis } from "@/lib/redis";

/**
 * Sicurezza della prima configurazione. Tutto qui gira solo sul server: il browser non vede mai
 * il codice di setup, il segreto di Better Auth né le stringhe di connessione.
 */

export const COOKIE_SETUP = "telaio-setup";
const DURATA_SESSIONE_SETUP_S = 2 * 60 * 60;
const LUNGHEZZA_MINIMA_TOKEN = 16;

export type ModalitaSetup =
  | { modalita: "aperto" }
  | { modalita: "token" }
  | { modalita: "bloccato"; motivo: string };

/**
 * Chi arriva per primo su un server pubblico potrebbe inizializzarlo al posto del proprietario.
 * Per questo in produzione il setup richiede un codice (SETUP_TOKEN) e senza non parte. In sviluppo
 * è libero, a meno che il codice non sia impostato.
 */
export function modalitaSetup(): ModalitaSetup {
  const token = process.env.SETUP_TOKEN?.trim() ?? "";
  if (/^CAMBIA/i.test(token))
    return {
      modalita: "bloccato",
      motivo:
        "SETUP_TOKEN è ancora il valore di esempio: sostituiscilo con un codice casuale e riavvia.",
    };
  if (token) {
    return token.length >= LUNGHEZZA_MINIMA_TOKEN
      ? { modalita: "token" }
      : {
          modalita: "bloccato",
          motivo: `SETUP_TOKEN è troppo corto: servono almeno ${LUNGHEZZA_MINIMA_TOKEN} caratteri.`,
        };
  }
  if (process.env.NODE_ENV === "production")
    return {
      modalita: "bloccato",
      motivo:
        "In produzione la configurazione iniziale richiede un codice: imposta SETUP_TOKEN (almeno 16 caratteri) nelle variabili d'ambiente e riavvia.",
    };
  return { modalita: "aperto" };
}

const baseUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const connessioneSicura = () => baseUrl().startsWith("https://");

function firma(scadenza: number): string {
  const segreto = process.env.BETTER_AUTH_SECRET ?? "";
  const token = process.env.SETUP_TOKEN ?? "";
  return createHmac("sha256", segreto).update(`setup|${scadenza}|${token}`).digest("hex");
}

function uguali(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Confronto a tempo costante del codice inserito con SETUP_TOKEN. */
export function codiceCorretto(inserito: string): boolean {
  if (modalitaSetup().modalita !== "token") return false;
  return uguali(inserito.trim(), process.env.SETUP_TOKEN?.trim() ?? "");
}

/** Dopo un codice corretto: cookie httpOnly firmato, valido per poche ore e solo sul percorso /setup. */
export async function concediAccesso() {
  const scadenza = Math.floor(Date.now() / 1000) + DURATA_SESSIONE_SETUP_S;
  (await cookies()).set(COOKIE_SETUP, `${scadenza}.${firma(scadenza)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: connessioneSicura(),
    path: "/setup",
    maxAge: DURATA_SESSIONE_SETUP_S,
  });
}

/** Il visitatore può usare il wizard? */
export async function accessoConsentito(): Promise<boolean> {
  const m = modalitaSetup();
  if (m.modalita === "aperto") return true;
  if (m.modalita === "bloccato") return false;
  const valore = (await cookies()).get(COOKIE_SETUP)?.value;
  const [scadenza, f] = valore?.split(".") ?? [];
  if (!scadenza || !f || !/^\d+$/.test(scadenza)) return false;
  if (Number(scadenza) < Date.now() / 1000) return false;
  return uguali(f, firma(Number(scadenza)));
}

/**
 * Convenzione di Better Auth: le richieste che modificano dati devono arrivare dall'origine fidata
 * (BETTER_AUTH_URL). Si aggiunge al controllo Origin/Host che Next.js fa già sulle Server Actions.
 */
export async function origineFidata(): Promise<boolean> {
  const origine = (await headers()).get("origin");
  if (!origine) return false;
  try {
    return new URL(origine).origin === new URL(baseUrl()).origin;
  } catch {
    return false;
  }
}

/**
 * Descrizione di un errore adatta ai log: senza i parametri della query. Gli errori di Drizzle li
 * includono, e tra i parametri ci sono email e hash della password dell'amministratore.
 */
export function descriviErrore(e: unknown): string {
  if (!(e instanceof Error)) return "errore sconosciuto";
  const causa = (e as { cause?: { code?: string; message?: string } }).cause;
  const testo = (causa?.message ?? e.message).split("\nparams:")[0] ?? "";
  return `${e.name}${causa?.code ? ` [${causa.code}]` : ""}: ${testo.slice(0, 300)}`;
}

export async function setupCompletato(): Promise<boolean> {
  return (await leggiStatoSetup(getDb())).completato;
}

export interface Controllo {
  id: string;
  etichetta: string;
  esito: "ok" | "avviso" | "errore";
  /** spiegazione generica: mai valori, indirizzi o credenziali */
  nota?: string;
  gruppo: "sistema" | "sicurezza";
}

const entro = <T>(p: Promise<T>, ms = 2000) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

/** Verifica dell'ambiente per il primo passo del wizard (e per quello sulla sicurezza). */
export async function controlliSistema(): Promise<Controllo[]> {
  const out: Controllo[] = [];
  try {
    await entro(getDb().execute(sql`select 1`));
    out.push({
      id: "db",
      etichetta: "Database PostgreSQL raggiungibile",
      esito: "ok",
      gruppo: "sistema",
    });
  } catch {
    out.push({
      id: "db",
      etichetta: "Database PostgreSQL non raggiungibile",
      esito: "errore",
      nota: "Controlla DATABASE_URL e che il database sia avviato.",
      gruppo: "sistema",
    });
  }
  try {
    await entro(getDb().execute(sql`select 1 from impostazioni limit 1`));
    out.push({
      id: "migrazioni",
      etichetta: "Migrazioni applicate",
      esito: "ok",
      gruppo: "sistema",
    });
  } catch {
    out.push({
      id: "migrazioni",
      etichetta: "Migrazioni non applicate",
      esito: "errore",
      nota: "Esegui le migrazioni del database prima di continuare.",
      gruppo: "sistema",
    });
  }
  try {
    await entro(getRedis().ping());
    out.push({ id: "redis", etichetta: "Redis raggiungibile", esito: "ok", gruppo: "sistema" });
  } catch {
    out.push({
      id: "redis",
      etichetta: "Redis non raggiungibile",
      esito: "avviso",
      nota: "Si può continuare, ma i job in background non funzioneranno finché Redis non risponde.",
      gruppo: "sistema",
    });
  }

  const segreto = process.env.BETTER_AUTH_SECRET ?? "";
  out.push({
    id: "segreto",
    etichetta:
      segreto.length >= 32
        ? "Segreto di autenticazione impostato"
        : "Segreto di autenticazione debole o mancante",
    esito: segreto.length >= 32 ? "ok" : "errore",
    nota:
      segreto.length >= 32
        ? undefined
        : "Imposta BETTER_AUTH_SECRET con almeno 32 caratteri casuali.",
    gruppo: "sicurezza",
  });
  const https = connessioneSicura();
  out.push({
    id: "https",
    etichetta: https ? "Connessione protetta (HTTPS)" : "Connessione non protetta (HTTP)",
    esito: https ? "ok" : "avviso",
    nota: https
      ? "I cookie di sessione sono marcati come sicuri."
      : "Le passkey e l'installazione come app richiedono HTTPS: usa un indirizzo https in BETTER_AUTH_URL.",
    gruppo: "sicurezza",
  });
  const modalita = modalitaSetup().modalita;
  out.push({
    id: "codice",
    etichetta:
      modalita === "token"
        ? "Configurazione protetta da codice"
        : "Configurazione aperta a chiunque raggiunga questa pagina",
    esito: modalita === "token" ? "ok" : "avviso",
    nota:
      modalita === "token"
        ? undefined
        : "Imposta SETUP_TOKEN per proteggere la prima configurazione.",
    gruppo: "sicurezza",
  });
  return out;
}
