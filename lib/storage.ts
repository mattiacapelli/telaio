import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage dei documenti su S3/MinIO.
 *
 * `forcePathStyle` è necessario con MinIO: senza, l'SDK userebbe URL con il
 * bucket come sottodominio, che in locale non risolvono.
 */
const globalForS3 = globalThis as unknown as { s3?: S3Client };

export const BUCKET = process.env.S3_BUCKET ?? "telaio";

function crea() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9002",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "telaio",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "telaio-secret",
    },
  });
}

export const s3 = globalForS3.s3 ?? crea();
if (process.env.NODE_ENV !== "production") globalForS3.s3 = s3;

export function storageConfigurato() {
  return Boolean(process.env.S3_ENDPOINT || process.env.NODE_ENV !== "production");
}

/** Crea il bucket al primo caricamento, se non esiste già. */
async function assicuraBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch {
      /* già creato da una richiesta parallela */
    }
  }
}

export async function caricaFile(
  chiave: string,
  corpo: Buffer,
  tipo: string,
) {
  await assicuraBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: chiave,
      Body: corpo,
      ContentType: tipo,
    }),
  );
}

/**
 * URL temporaneo per scaricare un file.
 *
 * I documenti non sono pubblici: il link è firmato e scade, così non basta
 * conoscere il percorso per accedervi.
 */
export async function urlDownload(chiave: string, nome: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: chiave,
      ResponseContentDisposition: `attachment; filename="${nome}"`,
    }),
    { expiresIn: 300 },
  );
}

export async function eliminaFile(chiave: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chiave }));
}
