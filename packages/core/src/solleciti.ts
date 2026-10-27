import { formatEuro } from "./money";

/** Giorni minimi tra un sollecito inviato e la proposta del successivo. */
export const GIORNI_TRA_SOLLECITI = 7;
export const LIVELLO_MASSIMO = 3;

export interface DatiSollecito {
  livello: number;
  cliente: string;
  emittente: string;
  descrizioneRata: string;
  importoCent: number;
  /** YYYY-MM-DD */
  scadenza: string;
  /** YYYY-MM-DD */
  oggi: string;
}

export function giorniDiRitardo(scadenza: string, oggi: string): number {
  const ms = Date.parse(`${oggi}T00:00:00Z`) - Date.parse(`${scadenza}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

function dataIt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Bozza del sollecito: un'ipotesi da rivedere. Non viene mai inviata senza conferma. */
export function bozzaSollecito(d: DatiSollecito): { oggetto: string; corpo: string } {
  const ritardo = giorniDiRitardo(d.scadenza, d.oggi);
  const importo = formatEuro(d.importoCent);
  const dettaglio = `${d.descrizioneRata}, importo ${importo}, scaduta il ${dataIt(d.scadenza)} (${ritardo} giorni fa)`;

  const toni: Record<number, { oggetto: string; apertura: string; chiusura: string }> = {
    1: {
      oggetto: `Promemoria di pagamento · ${d.descrizioneRata}`,
      apertura:
        "ti scrivo per ricordarti, nel caso fosse sfuggito, che risulta ancora aperto il pagamento seguente:",
      chiusura: "Se hai già provveduto, ti prego di ignorare questo messaggio. Grazie!",
    },
    2: {
      oggetto: `Secondo sollecito · ${d.descrizioneRata}`,
      apertura:
        "non risulta ancora pervenuto il pagamento seguente, già oggetto di un precedente promemoria:",
      chiusura:
        "Ti chiedo di provvedere a breve o di segnalarmi eventuali problemi, così li risolviamo insieme.",
    },
    3: {
      oggetto: `Ultimo sollecito · ${d.descrizioneRata}`,
      apertura: "nonostante i precedenti solleciti risulta ancora insoluto il pagamento seguente:",
      chiusura:
        "In assenza di riscontro entro 7 giorni valuteremo gli opportuni passi per il recupero del credito.",
    },
  };
  const t = toni[Math.min(Math.max(d.livello, 1), LIVELLO_MASSIMO)] ?? toni[1];
  if (!t) throw new Error("Livello di sollecito non valido");

  return {
    oggetto: t.oggetto,
    corpo: `Gentile ${d.cliente},\n\n${t.apertura}\n\n${dettaglio}\n\n${t.chiusura}\n\nCordiali saluti,\n${d.emittente}`,
  };
}

/** True se si può proporre un nuovo sollecito: nessuno in attesa, tetto non superato, distanza rispettata. */
export function serveSollecito(opts: {
  inviati: number;
  daConfermare: number;
  ultimoInvioIso: string | null;
  oggi: string;
}): boolean {
  if (opts.daConfermare > 0 || opts.inviati >= LIVELLO_MASSIMO) return false;
  if (!opts.ultimoInvioIso) return true;
  return giorniDiRitardo(opts.ultimoInvioIso.slice(0, 10), opts.oggi) >= GIORNI_TRA_SOLLECITI;
}
