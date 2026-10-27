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
  oggetto: string;
  testo: string;
}) {
  await getTransporter().sendMail({
    from: opts.da || process.env.SMTP_FROM || "Telaio <noreply@telaio.local>",
    to: opts.a,
    subject: opts.oggetto,
    text: opts.testo,
  });
}
