import { prisma } from "./prisma";

/**
 * Testi standard dei documenti.
 *
 * Sono modelli: al momento della creazione vengono copiati nel documento, che
 * resta poi indipendente. Modificare un modello non riscrive i documenti già
 * emessi — un preventivo inviato deve restare quello che il cliente ha letto.
 */

/** Campi che un testo standard può riempire, per ambito. */
export const CAMPI: Record<string, { chiave: string; etichetta: string; ambiti: string[] }[]> = {
  PREVENTIVO: [
    { chiave: "premessa", etichetta: "Premessa", ambiti: ["PREVENTIVO", "ENTRAMBI"] },
    { chiave: "tempiConsegna", etichetta: "Tempi di consegna", ambiti: ["PREVENTIVO", "ENTRAMBI"] },
    { chiave: "modalitaPagamento", etichetta: "Modalità di pagamento", ambiti: ["PREVENTIVO", "ENTRAMBI"] },
    { chiave: "note", etichetta: "Note", ambiti: ["PREVENTIVO", "ENTRAMBI"] },
  ],
  CONTRATTO: [
    { chiave: "premessa", etichetta: "Premessa", ambiti: ["CONTRATTO", "ENTRAMBI"] },
    { chiave: "oggetto", etichetta: "Oggetto del contratto", ambiti: ["CONTRATTO"] },
    { chiave: "condizioniPagamento", etichetta: "Condizioni di pagamento", ambiti: ["CONTRATTO", "ENTRAMBI"] },
    { chiave: "condizioniServizio", etichetta: "Condizioni di servizio", ambiti: ["CONTRATTO"] },
    { chiave: "note", etichetta: "Note", ambiti: ["CONTRATTO", "ENTRAMBI"] },
  ],
};

export const ETICHETTE_CAMPO: Record<string, string> = {
  premessa: "Premessa",
  oggetto: "Oggetto",
  tempiConsegna: "Tempi di consegna",
  modalitaPagamento: "Modalità di pagamento",
  condizioniPagamento: "Condizioni di pagamento",
  condizioniServizio: "Condizioni di servizio",
  note: "Note",
};

export const AMBITI: Record<string, string> = {
  PREVENTIVO: "Solo preventivi",
  CONTRATTO: "Solo contratti",
  ENTRAMBI: "Preventivi e contratti",
};

/**
 * Testi predefiniti per un tipo di documento.
 *
 * Restituisce una mappa campo → testo, pronta da usare come valore iniziale
 * di un nuovo documento.
 */
export async function testiPredefiniti(ambito: "PREVENTIVO" | "CONTRATTO") {
  const testi = await prisma.testoStandard.findMany({
    where: { predefinito: true, ambito: { in: [ambito, "ENTRAMBI"] } },
    orderBy: [{ ordine: "asc" }],
  });

  const out: Record<string, string> = {};
  for (const t of testi) {
    // Il primo vince: un testo specifico dell'ambito ha la precedenza su uno
    // generico solo se arriva prima nell'ordinamento.
    if (!(t.campo in out)) out[t.campo] = t.testo;
  }
  return out;
}

/** Sostituisce i segnaposto con i dati del documento. */
export function componiTesto(
  testo: string,
  valori: Record<string, string | number | null | undefined>,
) {
  return testo.replace(/\{(\w+)\}/g, (intero, chiave: string) => {
    const v = valori[chiave];
    return v === undefined || v === null ? intero : String(v);
  });
}
