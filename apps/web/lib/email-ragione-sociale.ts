import { conFirma, risolviMittente } from "@telaio/core";
import { type Database, eq, leggiEmail, ragioniSociali } from "@telaio/db";
import { inviaEmail } from "./email";

/**
 * Invia un'email a nome di una ragione sociale: mittente e indirizzo per le risposte dalle
 * impostazioni (con ripiego sull'email della ragione sociale e poi su SMTP_FROM), firma in coda.
 */
export async function inviaEmailPerRagioneSociale(
  db: Database,
  ragioneSocialeId: string | null | undefined,
  email: { a: string; oggetto: string; testo: string },
) {
  const impostazioni = await leggiEmail(db);
  const [rs] = ragioneSocialeId
    ? await db
        .select({ nome: ragioniSociali.nome, email: ragioniSociali.email })
        .from(ragioniSociali)
        .where(eq(ragioniSociali.id, ragioneSocialeId))
    : [];
  const { from, replyTo } = risolviMittente({
    mittente: ragioneSocialeId ? impostazioni.mittenti[ragioneSocialeId] : undefined,
    ragioneSociale: rs,
  });
  await inviaEmail({
    a: email.a,
    da: from,
    rispondiA: replyTo,
    oggetto: email.oggetto,
    testo: conFirma(email.testo, impostazioni.firma),
  });
}
