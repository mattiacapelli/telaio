import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Diario del progetto.
 *
 * Registrare un evento non deve mai far fallire l'operazione che lo ha
 * generato: se la scrittura del diario va male, l'azione principale resta
 * valida e si perde solo una riga di cronologia.
 */
export type TipoEvento =
  | "stato"
  | "attivita"
  | "milestone"
  | "problema"
  | "documento"
  | "nota"
  | "fattura"
  | "ore"
  | "modifica"
  | "github";

type Tx = Omit<PrismaClient, `$${string}`>;

export async function registraEvento(
  progettoId: string,
  tipo: TipoEvento,
  testo: string,
  opzioni: { dettaglio?: string | null; autore?: string | null; tx?: Tx } = {},
) {
  const client = opzioni.tx ?? prisma;
  try {
    await client.eventoProgetto.create({
      data: {
        progettoId,
        tipo,
        testo,
        dettaglio: opzioni.dettaglio ?? null,
        autore: opzioni.autore ?? null,
      },
    });
  } catch {
    /* il diario è accessorio: non blocca l'operazione */
  }
}
