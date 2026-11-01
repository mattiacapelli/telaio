import { z } from "zod";
import { formatoValido } from "./numerazione";

// Disponibile in Node e nei browser; il pacchetto non include i tipi DOM.
declare function atob(dati: string): string;

/** Regole di validazione del wizard di prima configurazione (usate dal client, dal server e dai test). */

export const TIPI_AZIENDA = [
  ["ditta_individuale", "Ditta individuale"],
  ["srl", "Società (S.r.l.)"],
  ["associazione", "Associazione"],
  ["altro", "Altro"],
] as const;
export const PAESI = [
  ["IT", "Italia"],
  ["SM", "San Marino"],
  ["CH", "Svizzera"],
  ["DE", "Germania"],
  ["FR", "Francia"],
  ["ES", "Spagna"],
  ["GB", "Regno Unito"],
  ["US", "Stati Uniti"],
] as const;
export const FUSI_ORARI = [
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;
export const VALUTE = [
  ["EUR", "Euro (€)"],
  ["CHF", "Franco svizzero (CHF)"],
  ["GBP", "Sterlina (£)"],
  ["USD", "Dollaro USA ($)"],
] as const;
export const LINGUE = [
  ["it", "Italiano"],
  ["en", "English"],
] as const;

/** Lunghezza minima della password dell'amministratore, in ogni caso. */
export const PASSWORD_MINIMA_BASE = 12;
export const OPZIONI_PASSWORD_MINIMA = [12, 14, 16] as const;
export const PASSWORD_MASSIMA = 128;
export const LOGO_MAX_BYTE = 200_000;

const valori = <T extends readonly (readonly [string, string])[]>(lista: T) =>
  lista.map(([v]) => v) as unknown as [T[number][0], ...T[number][0][]];

/** Controlla la cifra di controllo di una partita IVA italiana (11 cifre). */
export function partitaIvaItalianaValida(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false;
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let cifra = Number(piva[i]);
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return (10 - (somma % 10)) % 10 === Number(piva[10]);
}

/** Verifica che un data URL sia davvero un'immagine PNG, JPEG o WebP non troppo grande. */
export function logoValido(dataUrl: string): boolean {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m?.[2]) return false;
  const base64 = m[2];
  const byte =
    Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (byte <= 0 || byte > LOGO_MAX_BYTE) return false;
  let intestazione: string;
  try {
    intestazione = atob(base64.slice(0, 24));
  } catch {
    return false;
  }
  const b = [...intestazione].map((c) => c.charCodeAt(0));
  if (m[1] === "png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (m[1] === "jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return intestazione.startsWith("RIFF") && intestazione.slice(8, 12) === "WEBP";
}

const testoOpzionale = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

export const aziendaSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "Inserisci il nome dell'azienda")
      .max(120, "Il nome è troppo lungo"),
    tipo: z.enum(valori(TIPI_AZIENDA), "Scegli un tipo"),
    partitaIva: z
      .string()
      .trim()
      .nullish()
      .transform((v) => (v ? v.replace(/[\s.-]/g, "").toUpperCase() : null)),
    paese: z.enum(valori(PAESI), "Scegli il paese"),
    fusoOrario: z.enum(FUSI_ORARI, "Scegli il fuso orario"),
    valuta: z.enum(valori(VALUTE), "Scegli la valuta"),
    lingua: z.enum(valori(LINGUE), "Scegli la lingua"),
    logo: testoOpzionale,
  })
  .superRefine((v, ctx) => {
    if (v.partitaIva) {
      const valida =
        v.paese === "IT"
          ? partitaIvaItalianaValida(v.partitaIva)
          : /^[A-Z0-9]{5,20}$/.test(v.partitaIva);
      if (!valida)
        ctx.addIssue({
          code: "custom",
          path: ["partitaIva"],
          message:
            v.paese === "IT" ? "Partita IVA non valida (11 cifre)" : "Partita IVA non valida",
        });
    }
    if (v.logo && !logoValido(v.logo))
      ctx.addIssue({
        code: "custom",
        path: ["logo"],
        message: "Il logo deve essere un'immagine PNG, JPEG o WebP fino a 200 KB",
      });
  });
export type Azienda = z.infer<typeof aziendaSchema>;

const nomePersona = (etichetta: string) =>
  z.string().trim().min(1, `Inserisci il ${etichetta}`).max(60, "Troppo lungo");

/** Nome, cognome ed email dell'amministratore (la parte che si può salvare in chiaro). */
export const anagraficaAdminSchema = z.object({
  nome: nomePersona("nome"),
  cognome: nomePersona("cognome"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email troppo lunga")
    .pipe(z.email("Email non valida")),
});

/** `passwordMinima` è la lunghezza minima in vigore (almeno quella di base). */
export function adminSchema(passwordMinima: number = PASSWORD_MINIMA_BASE) {
  const minimo = Math.max(passwordMinima, PASSWORD_MINIMA_BASE);
  return anagraficaAdminSchema
    .extend({
      password: z
        .string()
        .min(minimo, `La password deve avere almeno ${minimo} caratteri`)
        .max(PASSWORD_MASSIMA, "Password troppo lunga"),
      conferma: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.password !== v.conferma)
        ctx.addIssue({ code: "custom", path: ["conferma"], message: "Le password non coincidono" });
      if (v.password.toLowerCase() === v.email)
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "La password non può essere uguale all'email",
        });
    });
}
export type Admin = z.infer<ReturnType<typeof adminSchema>>;

export const sicurezzaSchema = z.object({
  passwordMinima: z.union([z.literal(12), z.literal(14), z.literal(16)], "Scegli una lunghezza"),
  /** dopo il primo accesso, porta direttamente a 2FA e passkey */
  guidaSicurezza: z.boolean(),
});
export type Sicurezza = z.infer<typeof sicurezzaSchema>;

export const preferenzeSchema = z
  .object({
    ivaAttiva: z.boolean(),
    aliquotaIva: z
      .number("Inserisci l'aliquota")
      .min(0, "L'aliquota non può essere negativa")
      .max(100, "L'aliquota non può superare il 100%"),
    formatoPreventivo: z.string().trim().max(40, "Troppo lungo"),
    formatoFattura: z.string().trim().max(40, "Troppo lungo"),
  })
  .superRefine((v, ctx) => {
    for (const campo of ["formatoPreventivo", "formatoFattura"] as const) {
      if (!formatoValido(v[campo]))
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message: "Il formato deve contenere il numero progressivo, ad esempio {NNN}",
        });
    }
    if (Math.round(v.aliquotaIva * 100) !== v.aliquotaIva * 100 && v.ivaAttiva)
      ctx.addIssue({ code: "custom", path: ["aliquotaIva"], message: "Al massimo due decimali" });
  });
export type Preferenze = z.infer<typeof preferenzeSchema>;

/** Errori di una validazione come mappa campo → messaggio (il primo per ogni campo). */
export function erroriPerCampo(errore: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of errore.issues) {
    const campo = String(i.path[0] ?? "_");
    if (!(campo in out)) out[campo] = i.message;
  }
  return out;
}
