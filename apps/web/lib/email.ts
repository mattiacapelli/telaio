import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | undefined;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

export async function inviaEmail(opts: {
  a: string;
  da?: string | null;
  rispondiA?: string | null;
  oggetto: string;
  testo: string;
}) {
  await getTransporter().sendMail({
    from: opts.da || process.env.SMTP_FROM || "Telaio <noreply@telaio.local>",
    replyTo: opts.rispondiA || undefined,
    to: opts.a,
    subject: opts.oggetto,
    text: opts.testo,
  });
}

/** Com'è configurato l'invio (solo informazioni da mostrare: mai la password). */
export function statoSmtp() {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  return {
    configurato: host !== "",
    host: host || "localhost (predefinito)",
    porta: Number(process.env.SMTP_PORT ?? 1025),
    sicura: process.env.SMTP_SECURE === "true",
    autenticato: !!process.env.SMTP_USER,
    mittenteSistema: process.env.SMTP_FROM?.trim() || "Telaio <noreply@telaio.local>",
  };
}
