import type { Prisma, PrismaClient } from "@prisma/client";
import { n } from "./format";

export type VoceInput = {
  descrizione: string;
  quantita: number;
  unita?: string;
  prezzo: number;
};

/** Forma delle voci salvate dentro una revisione (colonna Json). */
export type VoceCongelata = {
  descrizione: string;
  nota: string | null;
  quantita: number;
  unita: string;
  prezzo: number;
  sconto: number;
};

type Tx = Omit<PrismaClient, `$${string}`>;

/**
 * Congela lo stato attuale del preventivo in una revisione.
 *
 * Copia le voci per valore: la revisione deve restare leggibile esattamente
 * com'era, anche dopo che il preventivo è stato modificato.
 *
 * Nota sul motivo: descrive la modifica che ha *sostituito* questa versione,
 * quindi non va scritto qui — appartiene alla revisione successiva. Chi chiama
 * lo passa dopo, con `motivaSuccessiva`.
 */
export async function congelaRevisione(
  tx: Tx,
  preventivoId: string,
  opzioni: { autore?: string | null } = {},
) {
  const p = await tx.preventivo.findUnique({
    where: { id: preventivoId },
    include: { voci: { orderBy: { ordine: "asc" } } },
  });
  if (!p) throw new Error("preventivo inesistente");

  const ultima = await tx.revisionePreventivo.findFirst({
    where: { preventivoId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  const voci: VoceCongelata[] = p.voci.map((v) => ({
    descrizione: v.descrizione,
    nota: v.nota,
    quantita: n(v.quantita),
    unita: v.unita,
    prezzo: n(v.prezzo),
    sconto: n(v.sconto),
  }));

  return tx.revisionePreventivo.create({
    data: {
      preventivoId,
      numero: (ultima?.numero ?? 0) + 1,
      titolo: p.titolo,
      imponibile: p.imponibile,
      scadeIl: p.scadeIl,
      autore: opzioni.autore ?? null,
      voci: voci as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Un preventivo già uscito dallo studio non va riscritto: da INVIATO in poi
 * ogni modifica deve produrre una nuova revisione.
 */
export function richiedeRevisione(stato: string) {
  return stato !== "BOZZA";
}

/** Etichetta mostrata all'utente: la prima revisione non porta suffisso. */
export function etichettaRevisione(numero: number) {
  return numero <= 1 ? "" : `r${numero}`;
}

/**
 * Registra il motivo sulla revisione appena diventata corrente.
 *
 * Il motivo spiega *perché si è passati* alla nuova versione: tenerlo sulla
 * revisione precedente farebbe leggere il cambiamento sulla riga sbagliata.
 */
export async function motivaSuccessiva(
  tx: Tx,
  preventivoId: string,
  numero: number,
  motivo: string | null | undefined,
  autore: string | null | undefined,
) {
  if (!motivo) return;
  await tx.revisionePreventivo.updateMany({
    where: { preventivoId, numero },
    data: { motivo, autore: autore ?? null },
  });
}
