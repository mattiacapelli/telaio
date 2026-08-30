/**
 * Catalogo dei blocchi che compongono un workflow.
 *
 * I blocchi sono salvati come JSON perché la loro forma cambia col tipo: un
 * modello relazionale per ogni variante renderebbe rigido qualcosa che deve
 * poter crescere. Questo catalogo è la fonte di verità sia per l'editor
 * (quali campi mostrare) sia per il motore (come eseguirli).
 */

export type Posizione = { x: number; y: number };

export type Blocco = {
  id: string;
  tipo: string;
  config: Record<string, string | number | boolean | null>;
  pos: Posizione;
};

export type Collegamento = { da: string; a: string };

export type SchemaWorkflow = {
  blocchi: Blocco[];
  collegamenti: Collegamento[];
};

export type CampoBlocco = {
  chiave: string;
  etichetta: string;
  tipo: "testo" | "numero" | "scelta" | "testolungo";
  opzioni?: { valore: string; etichetta: string }[];
  predefinito?: string | number;
  nota?: string;
};

export type DefinizioneBlocco = {
  tipo: string;
  etichetta: string;
  descrizione: string;
  categoria: "innesco" | "condizione" | "azione";
  tinta: string;
  campi: CampoBlocco[];
};

export const EVENTI = [
  { valore: "preventivo.accettato", etichetta: "Preventivo accettato" },
  { valore: "preventivo.inviato", etichetta: "Preventivo inviato" },
  { valore: "preventivo.rifiutato", etichetta: "Preventivo rifiutato" },
  { valore: "progetto.concluso", etichetta: "Progetto concluso" },
  { valore: "attivita.completata", etichetta: "Attività completata" },
  { valore: "milestone.raggiunta", etichetta: "Milestone raggiunta" },
  { valore: "problema.aperto", etichetta: "Criticità aperta" },
  { valore: "ticket.aperto", etichetta: "Ticket aperto" },
  { valore: "fattura.emessa", etichetta: "Fattura emessa" },
  { valore: "fattura.pagata", etichetta: "Fattura pagata" },
];

export const FREQUENZE = [
  { valore: "giornaliero", etichetta: "Ogni giorno" },
  { valore: "settimanale", etichetta: "Ogni lunedì" },
  { valore: "mensile", etichetta: "Il primo del mese" },
];

export const CATALOGO: DefinizioneBlocco[] = [
  {
    tipo: "innesco.evento",
    etichetta: "Quando accade",
    descrizione: "Parte quando succede qualcosa in Telaio",
    categoria: "innesco",
    tinta: "blue",
    campi: [
      { chiave: "evento", etichetta: "Evento", tipo: "scelta", opzioni: EVENTI, predefinito: "preventivo.accettato" },
    ],
  },
  {
    tipo: "innesco.pianificato",
    etichetta: "A intervalli",
    descrizione: "Parte a cadenza fissa",
    categoria: "innesco",
    tinta: "sky",
    campi: [
      { chiave: "frequenza", etichetta: "Frequenza", tipo: "scelta", opzioni: FREQUENZE, predefinito: "giornaliero" },
    ],
  },
  {
    tipo: "innesco.manuale",
    etichetta: "Su richiesta",
    descrizione: "Parte solo quando lo avvii tu",
    categoria: "innesco",
    tinta: "gray",
    campi: [],
  },
  {
    tipo: "condizione.valore",
    etichetta: "Se il valore",
    descrizione: "Confronta un importo dell'entità",
    categoria: "condizione",
    tinta: "yellow",
    campi: [
      {
        chiave: "campo", etichetta: "Campo", tipo: "scelta", predefinito: "imponibile",
        opzioni: [
          { valore: "imponibile", etichetta: "Imponibile" },
          { valore: "valore", etichetta: "Valore progetto" },
          { valore: "ore", etichetta: "Ore" },
        ],
      },
      {
        chiave: "operatore", etichetta: "Operatore", tipo: "scelta", predefinito: "maggiore",
        opzioni: [
          { valore: "maggiore", etichetta: "maggiore di" },
          { valore: "minore", etichetta: "minore di" },
          { valore: "uguale", etichetta: "uguale a" },
        ],
      },
      { chiave: "soglia", etichetta: "Soglia", tipo: "numero", predefinito: 5000 },
    ],
  },
  {
    tipo: "condizione.giorni",
    etichetta: "Se sono passati",
    descrizione: "Verifica i giorni trascorsi da una data",
    categoria: "condizione",
    tinta: "yellow",
    campi: [
      {
        chiave: "campo", etichetta: "Rispetto a", tipo: "scelta", predefinito: "scadeIl",
        opzioni: [
          { valore: "scadeIl", etichetta: "Scadenza" },
          { valore: "emessaIl", etichetta: "Data emissione" },
          { valore: "apertoIl", etichetta: "Data apertura" },
        ],
      },
      { chiave: "giorni", etichetta: "Giorni", tipo: "numero", predefinito: 7 },
    ],
  },
  {
    tipo: "condizione.stato",
    etichetta: "Se lo stato è",
    descrizione: "Confronta lo stato dell'entità",
    categoria: "condizione",
    tinta: "yellow",
    campi: [{ chiave: "stato", etichetta: "Stato", tipo: "testo", predefinito: "SCADUTA" }],
  },
  {
    tipo: "azione.creaProgetto",
    etichetta: "Crea progetto",
    descrizione: "Apre un progetto dal preventivo accettato",
    categoria: "azione",
    tinta: "orange",
    campi: [
      { chiave: "budgetOre", etichetta: "Budget ore", tipo: "numero", predefinito: 0, nota: "0 = dalle voci del preventivo" },
    ],
  },
  {
    tipo: "azione.creaAttivita",
    etichetta: "Crea attività",
    descrizione: "Aggiunge un'attività al progetto coinvolto",
    categoria: "azione",
    tinta: "green",
    campi: [
      { chiave: "titolo", etichetta: "Titolo", tipo: "testo", predefinito: "Nuova attività" },
      { chiave: "stimaOre", etichetta: "Stima ore", tipo: "numero", predefinito: 0 },
    ],
  },
  {
    tipo: "azione.notifica",
    etichetta: "Notifica",
    descrizione: "Crea una notifica dentro Telaio",
    categoria: "azione",
    tinta: "purple",
    campi: [
      { chiave: "titolo", etichetta: "Titolo", tipo: "testo", predefinito: "" },
      { chiave: "testo", etichetta: "Testo", tipo: "testolungo", predefinito: "" },
      {
        chiave: "livello", etichetta: "Livello", tipo: "scelta", predefinito: "info",
        opzioni: [
          { valore: "info", etichetta: "Informazione" },
          { valore: "attenzione", etichetta: "Attenzione" },
          { valore: "urgente", etichetta: "Urgente" },
        ],
      },
    ],
  },
  {
    tipo: "azione.email",
    etichetta: "Invia email",
    descrizione: "Manda un messaggio via SMTP",
    categoria: "azione",
    tinta: "pink",
    campi: [
      { chiave: "a", etichetta: "Destinatario", tipo: "testo", predefinito: "", nota: "vuoto = referente del cliente" },
      { chiave: "oggetto", etichetta: "Oggetto", tipo: "testo", predefinito: "" },
      { chiave: "corpo", etichetta: "Messaggio", tipo: "testolungo", predefinito: "" },
    ],
  },
  {
    tipo: "azione.webhook",
    etichetta: "Chiama webhook",
    descrizione: "Invia i dati dell'evento a un URL",
    categoria: "azione",
    tinta: "turquoise",
    campi: [{ chiave: "url", etichetta: "URL", tipo: "testo", predefinito: "https://" }],
  },
  {
    tipo: "azione.diario",
    etichetta: "Scrivi nel diario",
    descrizione: "Annota un evento sul progetto",
    categoria: "azione",
    tinta: "gray",
    campi: [{ chiave: "testo", etichetta: "Testo", tipo: "testo", predefinito: "" }],
  },
];

export function definizione(tipo: string) {
  return CATALOGO.find((d) => d.tipo === tipo);
}

/** Config iniziale di un blocco, dai valori predefiniti del catalogo. */
export function configPredefinita(tipo: string) {
  const d = definizione(tipo);
  if (!d) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const c of d.campi) out[c.chiave] = c.predefinito ?? "";
  return out;
}
