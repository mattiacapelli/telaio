/** Elenco degli strumenti MCP, usato dal server e dalla pagina Impostazioni → MCP. */
export interface StrumentoMcp {
  nome: string;
  descrizione: string;
  scrittura: boolean;
  /** `stub`: dichiarato e tipizzato, non ancora implementato */
  stato: "attivo" | "stub";
  /** area dell'app, per raggruppare l'elenco in Impostazioni → MCP */
  gruppo: string;
  /** non si può togliere la conferma (azioni con effetti verso l'esterno, come l'invio di email) */
  sempreConferma?: boolean;
}

/** Strumenti che non sono funzioni di dominio: sempre attivi e senza approvazione. */
export const STRUMENTO_STATO_AZIONE = "stato_azione";

/**
 * Se lo strumento aspetta la conferma dell'admin prima di girare. Impostazione per strumento
 * (Impostazioni → MCP); in mancanza, le scritture chiedono conferma e le letture no.
 */
export function richiedeApprovazione(s: StrumentoMcp, impostate: Record<string, boolean>): boolean {
  return s.sempreConferma ? true : (impostate[s.nome] ?? s.scrittura);
}

export const STRUMENTI_MCP: StrumentoMcp[] = [
  {
    nome: "cerca",
    descrizione: "Ricerca globale: clienti, preventivi e fatture per testo.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Generale",
  },
  {
    nome: "riepilogo",
    descrizione:
      "Cruscotto: preventivi in attesa, incassato del mese, da incassare, canoni, liquidità e cose da sistemare.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Generale",
  },
  {
    nome: "elenca_ragioni_sociali",
    descrizione: "Ragioni sociali con id, numerazioni e regole IVA (servono per creare documenti).",
    scrittura: false,
    stato: "attivo",
    gruppo: "Generale",
  },
  {
    nome: "cerca_clienti",
    descrizione: "Cerca clienti su Twenty per nome.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Clienti",
  },
  {
    nome: "dettaglio_cliente",
    descrizione: "Anagrafica, persone, opportunità e preventivi di un cliente.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Clienti",
  },
  {
    nome: "elenca_opportunita",
    descrizione: "Opportunità di Twenty, anche di una sola azienda.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Clienti",
  },
  {
    nome: "aggiorna_fase_opportunita",
    descrizione:
      "Sposta un'opportunità su Twenty a un'altra fase (unica scrittura ammessa verso il CRM).",
    scrittura: true,
    stato: "attivo",
    gruppo: "Clienti",
  },
  {
    nome: "listino",
    descrizione: "Basi, moduli e prezzi (netti e con IVA) dei listini.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Preventivi",
  },
  {
    nome: "elenca_preventivi",
    descrizione: "Elenco dei preventivi, filtrabile per stato.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Preventivi",
  },
  {
    nome: "dettaglio_preventivo",
    descrizione: "Preventivo con le sue righe e i totali.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Preventivi",
  },
  {
    nome: "crea_preventivo",
    descrizione: "Crea una bozza di preventivo da listino, con sconto e validità.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Preventivi",
  },
  {
    nome: "cambia_stato_preventivo",
    descrizione:
      "Cambia lo stato di un preventivo (inviato, accettato…); all'invio assegna il numero.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Preventivi",
  },
  {
    nome: "elenca_fatture",
    descrizione: "Fatture filtrabili per stato e periodo.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Fatture",
  },
  {
    nome: "dettaglio_fattura",
    descrizione: "Fattura con righe e incassi collegati.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Fatture",
  },
  {
    nome: "crea_fattura_da_preventivo",
    descrizione: "Crea la bozza di fattura da un preventivo accettato.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Fatture",
  },
  {
    nome: "crea_fattura_libera",
    descrizione: "Crea una bozza di fattura libera, anche per clienti occasionali o privati.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Fatture",
  },
  {
    nome: "emetti_fattura",
    descrizione: "Emette una bozza di fattura: assegna il numero e crea la rata nello scadenzario.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Fatture",
  },
  {
    nome: "scadenzario",
    descrizione: "Rate da incassare e scadute.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "elenca_incassi",
    descrizione: "Incassi registrati, filtrabili per periodo.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "registra_incasso",
    descrizione: "Registra un incasso su un conto, anche legato a una rata o a una fattura.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "elenca_conti",
    descrizione: "Conti con il saldo attuale.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "crea_conto",
    descrizione: "Crea un conto (corrente, cassa contante o carta).",
    scrittura: true,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "elenca_movimenti",
    descrizione: "Prima nota: entrate, uscite e giroconti.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "registra_movimento",
    descrizione: "Registra una entrata, uscita o giroconto in prima nota.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Incassi e cassa",
  },
  {
    nome: "elenca_solleciti",
    descrizione: "Solleciti in bozza da confermare, inviati o annullati.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Solleciti",
  },
  {
    nome: "invia_sollecito",
    descrizione: "Invia per email un sollecito rivisto. Chiede sempre la tua conferma.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Solleciti",
    sempreConferma: true,
  },
  {
    nome: "scarta_sollecito",
    descrizione: "Scarta una bozza di sollecito.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Solleciti",
  },
  {
    nome: "elenca_abbonamenti",
    descrizione: "Abbonamenti ricorrenti, filtrabili per stato.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Abbonamenti",
  },
  {
    nome: "dettaglio_abbonamento",
    descrizione: "Abbonamento con tutte le sue rate.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Abbonamenti",
  },
  {
    nome: "crea_abbonamento",
    descrizione: "Crea un abbonamento e genera le rate dei prossimi 12 mesi.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Abbonamenti",
  },
  {
    nome: "cambia_stato_abbonamento",
    descrizione: "Sospende, riattiva o cessa un abbonamento.",
    scrittura: true,
    stato: "attivo",
    gruppo: "Abbonamenti",
  },
  {
    nome: "cash_flow",
    descrizione: "Previsione di cassa a 6 mesi.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Analisi",
  },
  {
    nome: "report",
    descrizione: "Ricavi, IVA, costi e margine per mese, trimestre o anno, per ragione sociale.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Analisi",
  },
  {
    nome: "elenca_azioni_in_attesa",
    descrizione: "Azioni proposte e ancora da confermare.",
    scrittura: false,
    stato: "attivo",
    gruppo: "Analisi",
  },
];
