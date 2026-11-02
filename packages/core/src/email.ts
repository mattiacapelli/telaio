import { z } from "zod";

/** Mittenti e firma delle email. Le credenziali SMTP restano nelle variabili d'ambiente, non qui. */

const testo = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Al massimo ${max} caratteri`)
    .nullish()
    .transform((v) => v ?? "");

// Un indirizzo vuoto vale «non impostato»; uno scritto deve essere valido (niente ritorni a capo: header injection).
const indirizzoOpzionale = z
  .string()
  .trim()
  .max(254, "Indirizzo troppo lungo")
  .nullish()
  .transform((v) => v ?? "")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Email non valida");

export const mittenteSchema = z.object({
  /** nome mostrato ai destinatari; vuoto = nome della ragione sociale */
  nome: testo(80),
  /** indirizzo da cui parte l'email; vuoto = email della ragione sociale */
  email: indirizzoOpzionale,
  /** a chi arrivano le risposte, se diverso dal mittente */
  rispondiA: indirizzoOpzionale,
});
export type Mittente = z.infer<typeof mittenteSchema>;

export const emailImpostazioniSchema = z.object({
  /** in coda a ogni email inviata dall'app */
  firma: testo(500),
  /** per id di ragione sociale */
  mittenti: z.record(z.string(), mittenteSchema).default({}),
});
export type EmailImpostazioni = z.infer<typeof emailImpostazioniSchema>;

export const EMAIL_PREDEFINITE: EmailImpostazioni = { firma: "", mittenti: {} };

const pulisci = (s: string) =>
  s
    .replace(/[\r\n"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** «Nome» <indirizzo>, senza caratteri che potrebbero rompere l'intestazione. */
export function indirizzoConNome(nome: string, email: string): string {
  const n = pulisci(nome);
  return n ? `"${n}" <${email}>` : email;
}

/**
 * Da chi parte l'email di una ragione sociale. Ordine: mittente impostato → email della ragione
 * sociale → `undefined` (si usa il mittente di sistema SMTP_FROM).
 */
export function risolviMittente(opzioni: {
  mittente?: Mittente | null;
  ragioneSociale?: { nome?: string | null; email?: string | null } | null;
}): { from?: string; replyTo?: string } {
  const m = opzioni.mittente;
  const rs = opzioni.ragioneSociale;
  const indirizzo = m?.email || rs?.email || "";
  const out: { from?: string; replyTo?: string } = {};
  if (indirizzo) out.from = indirizzoConNome(m?.nome || rs?.nome || "", indirizzo);
  if (m?.rispondiA) out.replyTo = m.rispondiA;
  return out;
}

/** Aggiunge la firma al testo, separata da una riga vuota. */
export function conFirma(testoEmail: string, firma: string): string {
  const f = firma.trim();
  return f ? `${testoEmail.replace(/\s+$/, "")}\n\n-- \n${f}` : testoEmail;
}
