import { type ArchivioConfig, archivioConfigSchema } from "@telaio/core";
import { type Database, eq, impostazioni } from "@telaio/db";
import { cifra, decifra } from "./segreti";

export const CHIAVE_ARCHIVIO = "archivio.s3";

interface Salvato {
  endpoint?: string;
  region?: string;
  bucket?: string;
  prefisso?: string;
  pathStyle?: boolean;
  accessKeyId?: string;
  /** segreto cifrato (vedi segreti.ts) */
  secretCifrato?: string;
}

export interface Credenziali {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StatoArchivio {
  config: ArchivioConfig | null;
  /** assenti: il client S3 usa la catena predefinita di AWS (ruolo IAM, profilo…) */
  credenziali: Credenziali | null;
  origine: {
    config: "impostazioni" | "ambiente" | null;
    credenziali: "impostazioni" | "ambiente" | null;
  };
  /** chiavi salvate ma non più leggibili (segreto dell'app cambiato): vanno reinserite */
  segretoIllegibile: boolean;
  /** utente delle chiavi salvate, mai il segreto */
  accessKeyId: string | null;
}

function daAmbiente(): { config: ArchivioConfig | null; credenziali: Credenziali | null } {
  const env = process.env;
  const config = env.S3_BUCKET
    ? archivioConfigSchema.safeParse({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        prefisso: env.S3_PREFIX,
        pathStyle: env.S3_FORCE_PATH_STYLE === "true",
      })
    : null;
  return {
    config: config?.success ? config.data : null,
    credenziali:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : null,
  };
}

async function leggiSalvato(db: Pick<Database, "select">): Promise<Salvato> {
  const [r] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, CHIAVE_ARCHIVIO));
  return (r?.valore ?? {}) as Salvato;
}

/** Com'è configurato l'archivio: le impostazioni dell'app hanno la precedenza sulle variabili d'ambiente. */
export async function leggiArchivio(db: Pick<Database, "select">): Promise<StatoArchivio> {
  const salvato = await leggiSalvato(db);
  const amb = daAmbiente();
  const dalDb = salvato.bucket ? archivioConfigSchema.safeParse(salvato) : null;
  const config = dalDb?.success ? dalDb.data : amb.config;

  let credenziali: Credenziali | null = null;
  let origineCred: StatoArchivio["origine"]["credenziali"] = null;
  let segretoIllegibile = false;
  if (salvato.accessKeyId && salvato.secretCifrato) {
    const segreto = decifra(salvato.secretCifrato);
    if (segreto) {
      credenziali = { accessKeyId: salvato.accessKeyId, secretAccessKey: segreto };
      origineCred = "impostazioni";
    } else segretoIllegibile = true;
  }
  if (!credenziali && amb.credenziali) {
    credenziali = amb.credenziali;
    origineCred = "ambiente";
  }
  return {
    config,
    credenziali,
    origine: {
      config: dalDb?.success ? "impostazioni" : amb.config ? "ambiente" : null,
      credenziali: origineCred,
    },
    segretoIllegibile,
    accessKeyId: salvato.accessKeyId ?? null,
  };
}

export type ModificaChiavi =
  | { azione: "mantieni" }
  | { azione: "rimuovi" }
  /** cambia una o entrambe; quella non indicata resta com'è, ma alla fine servono tutte e due */
  | { azione: "imposta"; accessKeyId?: string; secretAccessKey?: string };

export async function salvaArchivio(db: Database, config: ArchivioConfig, chiavi: ModificaChiavi) {
  const att = await leggiSalvato(db);
  const nuovo: Salvato = { ...config };
  if (chiavi.azione === "mantieni") {
    nuovo.accessKeyId = att.accessKeyId;
    nuovo.secretCifrato = att.secretCifrato;
  } else if (chiavi.azione === "imposta") {
    nuovo.accessKeyId = chiavi.accessKeyId || att.accessKeyId;
    nuovo.secretCifrato = chiavi.secretAccessKey
      ? cifra(chiavi.secretAccessKey)
      : att.secretCifrato;
    if (!nuovo.accessKeyId || !nuovo.secretCifrato)
      throw new Error("Inserisci access key e secret key insieme");
  }
  await db
    .insert(impostazioni)
    .values({ chiave: CHIAVE_ARCHIVIO, valore: nuovo })
    .onConflictDoUpdate({
      target: impostazioni.chiave,
      set: { valore: nuovo, updatedAt: new Date() },
    });
}

/** Toglie tutta la configurazione salvata (resta il ripiego sulle variabili d'ambiente). */
export async function azzeraArchivio(db: Database) {
  await db.delete(impostazioni).where(eq(impostazioni.chiave, CHIAVE_ARCHIVIO));
}
