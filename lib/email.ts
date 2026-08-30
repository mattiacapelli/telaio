import nodemailer from "nodemailer";

/**
 * Invio email via SMTP.
 *
 * Facoltativo come GitHub: senza configurazione le azioni email vengono
 * saltate con un messaggio nel registro, invece di far fallire il workflow.
 */
export function emailConfigurata() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

let trasporto: nodemailer.Transporter | null = null;

function client() {
  if (trasporto) return trasporto;
  trasporto = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // 465 implica TLS implicito; le altre porte usano STARTTLS.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return trasporto;
}

export async function inviaEmail({
  a,
  oggetto,
  corpo,
}: {
  a: string;
  oggetto: string;
  corpo: string;
}) {
  if (!emailConfigurata()) return false;
  try {
    await client().sendMail({
      from: process.env.SMTP_FROM,
      to: a,
      subject: oggetto,
      text: corpo,
    });
    return true;
  } catch {
    // L'errore finisce nel registro del workflow tramite il valore di ritorno.
    return false;
  }
}
