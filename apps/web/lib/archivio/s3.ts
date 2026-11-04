import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ArchivioConfig } from "@telaio/core";
import { type Database, getDb } from "@telaio/db";
import { type Credenziali, leggiArchivio } from "./config";

export interface Archivio {
  client: S3Client;
  config: ArchivioConfig;
}

const NON_CONFIGURATO =
  "Archivio documenti non configurato: imposta il bucket in Impostazioni → Archiviazione";

const clienti = new Map<string, S3Client>();

function creaClient(config: ArchivioConfig, credenziali: Credenziali | null): S3Client {
  const chiave = JSON.stringify([config, credenziali]);
  let c = clienti.get(chiave);
  if (!c) {
    c = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.pathStyle,
      credentials: credenziali ?? undefined,
      // Alcuni servizi compatibili con S3 non accettano i checksum aggiuntivi dell'SDK recente.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    if (clienti.size > 4) clienti.clear();
    clienti.set(chiave, c);
  }
  return c;
}

/** Il client S3 e la configurazione attuali, oppure un errore leggibile se manca il bucket. */
export async function archivioPronto(db: Database = getDb()): Promise<Archivio> {
  const s = await leggiArchivio(db);
  if (!s.config) throw new Error(NON_CONFIGURATO);
  return { client: creaClient(s.config, s.credenziali), config: s.config };
}

export const clientDa = creaClient;

export async function caricaOggetto(a: Archivio, chiave: string, corpo: Buffer, tipoMime: string) {
  await a.client.send(
    new PutObjectCommand({
      Bucket: a.config.bucket,
      Key: chiave,
      Body: corpo,
      ContentType: tipoMime,
      ContentLength: corpo.length,
    }),
  );
}

export async function leggiOggetto(a: Archivio, chiave: string) {
  const r = await a.client.send(new GetObjectCommand({ Bucket: a.config.bucket, Key: chiave }));
  if (!r.Body) throw new Error("File vuoto o non trovato nell'archivio");
  return {
    corpo: r.Body.transformToWebStream(),
    lunghezza: r.ContentLength ?? null,
  };
}

export async function eliminaOggetto(a: Archivio, chiave: string) {
  await a.client.send(new DeleteObjectCommand({ Bucket: a.config.bucket, Key: chiave }));
}

/** Messaggio in italiano per gli errori più comuni di S3 e della rete. */
export function messaggioErrore(e: unknown): string {
  const err = e as {
    name?: string;
    Code?: string;
    message?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const nome = err.name ?? err.Code ?? err.code ?? "";
  const stato = err.$metadata?.httpStatusCode;
  if (nome === "NoSuchBucket" || nome === "NotFound" || stato === 404)
    return "Il bucket non esiste (o l'endpoint non è quello giusto). Controlla il nome o crealo.";
  if (nome === "InvalidAccessKeyId") return "Access key non riconosciuta dal servizio.";
  if (nome === "SignatureDoesNotMatch")
    return "Firma non valida: la secret key è sbagliata o la regione non corrisponde.";
  if (nome === "AccessDenied" || nome === "Forbidden" || stato === 403)
    return "Accesso negato: le chiavi non hanno i permessi sul bucket (servono lettura, scrittura ed eliminazione).";
  if (nome === "CredentialsProviderError")
    return "Nessuna credenziale: inserisci access key e secret key, oppure usa un ruolo IAM sul server.";
  if (
    ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(
      nome,
    ) ||
    /ECONNREFUSED|ENOTFOUND|getaddrinfo|timed? ?out/i.test(err.message ?? "")
  )
    return "Il servizio non è raggiungibile dal server: controlla l'indirizzo dell'endpoint.";
  return err.message
    ? `${nome ? `${nome}: ` : ""}${err.message}`
    : "Errore sconosciuto dell'archivio";
}

/** Prova a scrivere, leggere ed eliminare un piccolo oggetto di prova nel bucket. */
export async function provaConnessione(a: Archivio): Promise<void> {
  const chiave = `${a.config.prefisso}.telaio-prova/${randomUUID()}`;
  const testo = "telaio";
  await a.client.send(new HeadBucketCommand({ Bucket: a.config.bucket }));
  await caricaOggetto(a, chiave, Buffer.from(testo), "text/plain");
  try {
    const { corpo } = await leggiOggetto(a, chiave);
    const letto = await new Response(corpo).text();
    if (letto !== testo) throw new Error("Il file di prova letto non corrisponde a quello scritto");
  } finally {
    await eliminaOggetto(a, chiave);
  }
}

export async function creaBucket(a: Archivio): Promise<void> {
  await a.client.send(
    new CreateBucketCommand({
      Bucket: a.config.bucket,
      // Su AWS fuori da us-east-1 serve indicare la regione; i servizi compatibili non la richiedono.
      ...(!a.config.endpoint && a.config.region !== "us-east-1"
        ? { CreateBucketConfiguration: { LocationConstraint: a.config.region as never } }
        : {}),
    }),
  );
}
