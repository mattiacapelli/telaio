import type { Azienda, Impostazioni } from "@prisma/client";
import { s3, BUCKET } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { n } from "@/lib/format";
import type { DatiDocumento } from "./generatore";

/**
 * Emittente e bollo per `generaPdf`, a partire dall'Azienda scelta (o quella
 * predefinita) e dalle Impostazioni. Il generatore gira lato server, quindi
 * il logo si scarica qui come buffer: niente URL firmata, non serve.
 */
export async function emittenteDocumento(
  azienda: Azienda | null,
  impostazioni: Impostazioni | null,
): Promise<Pick<DatiDocumento, "emittente" | "bollo">> {
  const logo = azienda?.logoChiave ? await scaricaLogo(azienda.logoChiave) : null;

  return {
    emittente: {
      ragioneSociale: azienda?.ragioneSociale ?? "Studio",
      partitaIva: azienda?.partitaIva,
      codiceFiscale: azienda?.codiceFiscale,
      iban: azienda?.iban,
      regimeFiscale: azienda?.regimeFiscale,
      indirizzo: azienda?.indirizzo,
      citta: azienda?.citta,
      cap: azienda?.cap,
      provincia: azienda?.provincia,
      telefono: azienda?.telefono,
      email: azienda?.email,
      pec: azienda?.pec,
      sitoWeb: azienda?.sitoWeb,
      logo,
    },
    bollo: impostazioni
      ? { soglia: n(impostazioni.sogliaBollo), importo: n(impostazioni.importoBollo) }
      : null,
  };
}

async function scaricaLogo(chiave: string): Promise<Buffer | null> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: chiave }));
    const bytes = await r.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    // Logo mancante o storage irraggiungibile: il PDF si stampa comunque.
    return null;
  }
}
