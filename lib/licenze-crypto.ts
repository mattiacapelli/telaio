import {
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

/**
 * Firma digitale a due livelli per le licenze dei prodotti.
 *
 * Ogni prodotto in modalità offline ha UNA coppia di chiavi "master": la
 * pubblica va compilata dentro il software del cliente, la privata non
 * lascia mai Telaio. Ogni licenza ha una propria coppia dedicata — la
 * pubblica viene certificata (firmata) dalla privata master, la privata di
 * licenza firma il payload e viene scartata subito dopo, non è mai salvata.
 *
 * Il software installato verifica offline, senza rete: prima il
 * certificato con la master che ha embeddata, poi il payload con la
 * pubblica di licenza appena validata da quel certificato.
 *
 * Ed25519 nativo di Node: chiavi e firme compatte (44/48/64 byte), nessuna
 * dipendenza esterna, firma deterministica (niente RNG debole per-firma
 * come in ECDSA), nessun parametro di padding da sbagliare come in RSA.
 */

export function generaCoppiaChiavi() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    pubblica: publicKey.toString("base64"),
    privata: privateKey.toString("base64"),
  };
}

function firma(datiBase64Buffer: Buffer, privataBase64: string) {
  const chiave = { key: Buffer.from(privataBase64, "base64"), format: "der" as const, type: "pkcs8" as const };
  return sign(null, datiBase64Buffer, chiave).toString("base64");
}

function verificaFirma(datiBuffer: Buffer, firmaBase64: string, pubblicaBase64: string) {
  const chiave = { key: Buffer.from(pubblicaBase64, "base64"), format: "der" as const, type: "spki" as const };
  return verify(null, datiBuffer, chiave, Buffer.from(firmaBase64, "base64"));
}

// ------------------------------------------------------------ certificazione

/** La master del prodotto certifica la pubblica di una licenza specifica. */
export function certificaChiaveLicenza(pubblicaLicenzaBase64: string, privataMasterBase64: string) {
  return firma(Buffer.from(pubblicaLicenzaBase64, "base64"), privataMasterBase64);
}

export function verificaCertificato(
  pubblicaLicenzaBase64: string,
  certificatoBase64: string,
  pubblicaMasterBase64: string,
) {
  return verificaFirma(Buffer.from(pubblicaLicenzaBase64, "base64"), certificatoBase64, pubblicaMasterBase64);
}

// ------------------------------------------------------------ payload licenza

export type PayloadLicenza = {
  licenzaId: string;
  prodotto: string;
  cliente: string;
  emessaIl: string;
  scadeIl: string | null;
  seats?: number;
  moduli?: string[];
  hardwareId?: string;
};

/**
 * Firma sempre il payload così com'è arrivato, mai ricostruito: l'ordine
 * delle chiavi in un oggetto JS è stabile per inserimento, ma ricostruire
 * l'oggetto con un ordine diverso tra firma e verifica romperebbe
 * silenziosamente la corrispondenza tra i due `JSON.stringify`.
 */
export function firmaPayload(payload: PayloadLicenza, privataLicenzaBase64: string) {
  return firma(Buffer.from(JSON.stringify(payload)), privataLicenzaBase64);
}

export function verificaPayload(payload: PayloadLicenza, firmaBase64: string, pubblicaLicenzaBase64: string) {
  return verificaFirma(Buffer.from(JSON.stringify(payload)), firmaBase64, pubblicaLicenzaBase64);
}

// ------------------------------------------------------------ file di licenza

export type FileLicenza = {
  versione: 1;
  payload: PayloadLicenza;
  chiavePubblicaLicenza: string;
  certificato: string;
  firma: string;
};

/**
 * Verifica in due passi obbligati: prima il certificato — se non combacia
 * con la master, l'intero file è da scartare a prescindere dalla firma del
 * payload, perché la pubblica di licenza non è garantita genuina. Solo dopo
 * si usa quella pubblica per verificare la firma del payload. La scadenza è
 * un controllo separato, non crittografico.
 */
export function verificaFileLicenza(
  file: FileLicenza,
  pubblicaMasterBase64: string,
): { valido: boolean; motivo?: string } {
  const certificatoOk = verificaCertificato(file.chiavePubblicaLicenza, file.certificato, pubblicaMasterBase64);
  if (!certificatoOk) return { valido: false, motivo: "certificato non valido" };

  const firmaOk = verificaPayload(file.payload, file.firma, file.chiavePubblicaLicenza);
  if (!firmaOk) return { valido: false, motivo: "firma del payload non valida" };

  if (file.payload.scadeIl && new Date(file.payload.scadeIl) < new Date()) {
    return { valido: false, motivo: "licenza scaduta" };
  }

  return { valido: true };
}

// ------------------------------------------------------------ cifratura a riposo

/**
 * AES-256-GCM per la sola privata master (l'unica chiave privata che Telaio
 * persiste). GCM invece di CBC perché autentica: un blob alterato — bug,
 * migrazione sbagliata, accesso non autorizzato al DB — fa fallire subito
 * la decifratura invece di produrre bytes spazzatura interpretati come una
 * chiave valida ma sbagliata. Il prefisso di versione permette in futuro un
 * algoritmo/KDF diverso senza ambiguità sulle righe già cifrate: ruotare
 * LICENSE_ENCRYPTION_KEY richiede uno script una tantum (decifra con la
 * vecchia, ricifra con la nuova con entrambe disponibili in env), non
 * implementato qui perché non richiesto.
 */
const VERSIONE_CIFRATURA = "v1";

function chiaveCifratura() {
  const esadecimale = process.env.LICENSE_ENCRYPTION_KEY;
  if (!esadecimale) {
    throw new Error("LICENSE_ENCRYPTION_KEY non configurata: impossibile generare una chiave master in sicurezza");
  }
  const chiave = Buffer.from(esadecimale, "hex");
  if (chiave.length !== 32) {
    throw new Error("LICENSE_ENCRYPTION_KEY deve essere una stringa esadecimale di 32 byte (64 caratteri)");
  }
  return chiave;
}

export function cifraChiavePrivata(privataBase64: string) {
  const chiave = chiaveCifratura();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chiave, iv);
  const cifrato = Buffer.concat([cipher.update(privataBase64, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSIONE_CIFRATURA, iv.toString("base64"), authTag.toString("base64"), cifrato.toString("base64")].join(":");
}

export function decifraChiavePrivata(valore: string) {
  const [versione, ivBase64, authTagBase64, cifratoBase64] = valore.split(":");
  if (versione !== VERSIONE_CIFRATURA || !ivBase64 || !authTagBase64 || !cifratoBase64) {
    throw new Error("formato di cifratura non riconosciuto");
  }
  const chiave = chiaveCifratura();
  const decipher = createDecipheriv("aes-256-gcm", chiave, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));
  // Un auth tag che non combacia (chiave sbagliata o blob manomesso) fa
  // lanciare qui: non c'è un fallback silenzioso.
  const chiaroBuffer = Buffer.concat([decipher.update(Buffer.from(cifratoBase64, "base64")), decipher.final()]);
  return chiaroBuffer.toString("utf8");
}
