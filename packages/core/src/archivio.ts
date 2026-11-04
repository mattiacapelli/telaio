import { z } from "zod";

/**
 * Archivio dei documenti dei progetti su un bucket S3 (o compatibile): configurazione, nomi degli
 * oggetti e limiti. Nessun I/O: il client S3 sta nell'app.
 */

export const CATEGORIE_DOCUMENTO = [
  "contratto",
  "specifiche",
  "design",
  "consegna",
  "altro",
] as const;
export type CategoriaDocumento = (typeof CATEGORIE_DOCUMENTO)[number];

export const ETICHETTE_CATEGORIA_DOCUMENTO: Record<CategoriaDocumento, string> = {
  contratto: "Contratto",
  specifiche: "Specifiche",
  design: "Design",
  consegna: "Consegna",
  altro: "Altro",
};

/** Dimensione massima di un file: passa dal server dell'app, non direttamente dal browser. */
export const LIMITE_FILE_BYTE = 25 * 1024 * 1024;

const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** Prefisso comune a tutti gli oggetti: senza barra iniziale, con una sola barra finale. */
export function normalizzaPrefisso(p: string): string {
  const pulito = p
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s !== "" && s !== "." && s !== "..")
    .join("/");
  return pulito ? `${pulito}/` : "";
}

export const archivioConfigSchema = z.object({
  /** vuoto = AWS S3; per MinIO, Cloudflare R2, Backblaze ecc. l'indirizzo del servizio */
  endpoint: z
    .string()
    .trim()
    .max(300, "Indirizzo troppo lungo")
    .nullish()
    .transform((v) => (v ? v.replace(/\/+$/, "") : ""))
    .refine((v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password;
      } catch {
        return false;
      }
    }, "Indirizzo non valido: deve iniziare con http:// o https://, senza utente e password"),
  region: z
    .string()
    .trim()
    .max(50)
    .nullish()
    .transform((v) => v || "us-east-1")
    .refine((v) => /^[a-z0-9-]+$/i.test(v), "Regione non valida"),
  bucket: z
    .string()
    .trim()
    .refine(
      (v) => BUCKET_RE.test(v),
      "Nome del bucket non valido (3–63 caratteri: minuscole, cifre, punti e trattini)",
    ),
  prefisso: z
    .string()
    .trim()
    .max(100, "Al massimo 100 caratteri")
    .nullish()
    .transform((v) => normalizzaPrefisso(v ?? "")),
  /** indirizzi del tipo https://host/bucket invece di https://bucket.host: serve a MinIO e simili */
  pathStyle: z.boolean().default(false),
});
export type ArchivioConfig = z.infer<typeof archivioConfigSchema>;

/** Nome di un file caricato, reso innocuo: niente percorsi, niente caratteri di controllo. */
export function nomeFileSicuro(nome: string): string {
  const base = nome.replace(/\\/g, "/").split("/").pop() ?? "";
  const pulito = base
    .replace(/[\u0000-\u001f\u007f"<>|?*:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const senzaPunti = pulito.replace(/^\.+/, "");
  if (senzaPunti === "") return "file";
  if (senzaPunti.length <= 150) return senzaPunti;
  const punto = senzaPunti.lastIndexOf(".");
  const estensione = punto > 0 && senzaPunti.length - punto <= 12 ? senzaPunti.slice(punto) : "";
  return senzaPunti.slice(0, 150 - estensione.length) + estensione;
}

/** Chiave dell'oggetto nel bucket. L'id del documento la rende unica anche con nomi uguali. */
export function chiaveOggetto(opzioni: {
  prefisso: string;
  progettoId: string;
  documentoId: string;
  nome: string;
}): string {
  return `${normalizzaPrefisso(opzioni.prefisso)}progetti/${opzioni.progettoId}/${opzioni.documentoId}/${nomeFileSicuro(opzioni.nome)}`;
}

/** «1,2 MB», «340 KB», «12 B». */
export function formattaDimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  const n = (v: number) => v.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  if (byte < 1024 * 1024) return `${n(byte / 1024)} KB`;
  if (byte < 1024 * 1024 * 1024) return `${n(byte / 1024 / 1024)} MB`;
  return `${n(byte / 1024 / 1024 / 1024)} GB`;
}

export const documentoDatiSchema = z.object({
  categoria: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(CATEGORIE_DOCUMENTO).default("altro"),
  ),
  descrizione: z
    .string()
    .trim()
    .max(500, "Al massimo 500 caratteri")
    .nullish()
    .transform((v) => (v ? v : null)),
});
