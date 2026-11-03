/** Ricerca testuale della barra «Cerca»: confronto senza maiuscole né accenti, per parole. */

export function normalizzaTesto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface VoceCercabile {
  titolo: string;
  sottotitolo?: string;
  /** sinonimi e parole collegate: «smtp» per le impostazioni email */
  parole?: readonly string[];
}

/**
 * Quanto una voce corrisponde alla ricerca: 0 = non corrisponde. Ogni parola cercata deve comparire
 * da qualche parte; conta di più se è all'inizio del titolo o di una sua parola.
 */
export function punteggioRicerca(query: string, voce: VoceCercabile): number {
  const parole = normalizzaTesto(query).split(" ").filter(Boolean);
  if (parole.length === 0) return 0;
  const titolo = normalizzaTesto(voce.titolo);
  const altro = normalizzaTesto([voce.sottotitolo ?? "", ...(voce.parole ?? [])].join(" "));
  const paroleTitolo = titolo.split(" ");
  let totale = 0;
  for (const p of parole) {
    if (titolo.startsWith(p)) totale += 100;
    else if (paroleTitolo.some((w) => w.startsWith(p))) totale += 70;
    else if (titolo.includes(p)) totale += 40;
    // «incasso» trova «Incassi»: senza l'ultima lettera (vocale del singolare/plurale)
    else if (p.length >= 5 && paroleTitolo.some((w) => w.startsWith(p.slice(0, -1)))) totale += 55;
    else if (altro.split(" ").some((w) => w.startsWith(p))) totale += 25;
    else if (altro.includes(p)) totale += 10;
    else return 0;
  }
  return totale / parole.length;
}
