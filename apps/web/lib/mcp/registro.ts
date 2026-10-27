/** Elenco degli strumenti MCP, usato dal server e dalla pagina Impostazioni → MCP. */
export interface StrumentoMcp {
  nome: string;
  descrizione: string;
  scrittura: boolean;
  /** `stub`: dichiarato e tipizzato, non ancora implementato */
  stato: "attivo" | "stub";
}

export const STRUMENTI_MCP: StrumentoMcp[] = [
  {
    nome: "cerca_clienti",
    descrizione: "Cerca clienti su Twenty per nome.",
    scrittura: false,
    stato: "attivo",
  },
  {
    nome: "dettaglio_cliente",
    descrizione: "Anagrafica, persone e opportunità di un cliente.",
    scrittura: false,
    stato: "stub",
  },
  {
    nome: "elenca_preventivi",
    descrizione: "Elenco dei preventivi, filtrabile per stato.",
    scrittura: false,
    stato: "attivo",
  },
  {
    nome: "listino",
    descrizione: "Basi, moduli e prezzi (netti e con IVA) dei listini.",
    scrittura: false,
    stato: "attivo",
  },
  {
    nome: "scadenzario",
    descrizione: "Rate da incassare e scadute.",
    scrittura: false,
    stato: "stub",
  },
  {
    nome: "cash_flow",
    descrizione: "Previsione di cassa a 6 mesi.",
    scrittura: false,
    stato: "stub",
  },
  {
    nome: "crea_preventivo",
    descrizione: "Propone una bozza di preventivo: richiede conferma in Telaio.",
    scrittura: true,
    stato: "attivo",
  },
  {
    nome: "registra_incasso",
    descrizione: "Propone la registrazione di un incasso: richiede conferma.",
    scrittura: true,
    stato: "stub",
  },
  {
    nome: "emetti_fattura",
    descrizione: "Propone l'emissione di una fattura: richiede conferma.",
    scrittura: true,
    stato: "stub",
  },
];
