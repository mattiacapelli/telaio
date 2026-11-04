import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Cifratura dei segreti salvati nel database (le chiavi del bucket): AES-256-GCM con una chiave
 * ricavata da BETTER_AUTH_SECRET. Chi legge il database senza il segreto dell'app non li apre.
 * Se il segreto dell'app cambia, i segreti salvati non si decifrano più e vanno reinseriti.
 */
function chiave(): Buffer {
  const segreto = process.env.BETTER_AUTH_SECRET;
  if (!segreto) throw new Error("BETTER_AUTH_SECRET non impostato: non si possono salvare segreti");
  return Buffer.from(hkdfSync("sha256", segreto, "telaio", "archivio-s3", 32));
}

export function cifra(testo: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chiave(), iv);
  const dati = Buffer.concat([c.update(testo, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), dati]
    .map((x) => (typeof x === "string" ? x : x.toString("base64")))
    .join(".");
}

/** Il testo in chiaro, o `null` se il valore è alterato o cifrato con un altro segreto. */
export function decifra(valore: string): string | null {
  try {
    const [versione, iv, tag, dati] = valore.split(".");
    if (versione !== "v1" || !iv || !tag || !dati) return null;
    const d = createDecipheriv("aes-256-gcm", chiave(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(dati, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
