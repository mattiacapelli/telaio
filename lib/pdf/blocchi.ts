/**
 * Catalogo dei blocchi che compongono un PDF.
 *
 * È la fonte di verità sia per il builder (quali blocchi si possono
 * aggiungere e come si configurano) sia per il generatore (come si stampano).
 */

export type BloccoPdf = {
  id: string;
  tipo: string;
  /** Un blocco disattivato resta nel modello ma non viene stampato. */
  attivo: boolean;
  config: Record<string, string | number | boolean>;
};

export type StilePdf = {
  margine: number;
  coloreAccento: string;
  dimensioneBase: number;
  mostraNumerazione: boolean;
};

export const STILE_PREDEFINITO: StilePdf = {
  margine: 56,
  coloreAccento: "#000000",
  dimensioneBase: 9.5,
  mostraNumerazione: true,
};

export type CampoBlocco = {
  chiave: string;
  etichetta: string;
  tipo: "testo" | "booleano" | "numero" | "scelta";
  opzioni?: { valore: string; etichetta: string }[];
  predefinito: string | number | boolean;
  nota?: string;
};

export type DefinizioneBlocco = {
  tipo: string;
  etichetta: string;
  descrizione: string;
  ambiti: ("PREVENTIVO" | "CONTRATTO")[];
  /** Un blocco unico non può essere aggiunto due volte allo stesso modello. */
  unico?: boolean;
  campi: CampoBlocco[];
};

export const CATALOGO_BLOCCHI: DefinizioneBlocco[] = [
  {
    tipo: "intestazione",
    etichetta: "Intestazione",
    descrizione: "Ragione sociale e dati fiscali dello studio",
    ambiti: ["PREVENTIVO", "CONTRATTO"],
    unico: true,
    campi: [
      { chiave: "mostraLogo", etichetta: "Mostra il logo", tipo: "booleano", predefinito: true },
      { chiave: "mostraIndirizzo", etichetta: "Mostra indirizzo", tipo: "booleano", predefinito: true },
      { chiave: "mostraPartitaIva", etichetta: "Mostra la partita IVA", tipo: "booleano", predefinito: true },
      { chiave: "mostraCodiceFiscale", etichetta: "Mostra il codice fiscale", tipo: "booleano", predefinito: false },
      { chiave: "mostraContatti", etichetta: "Mostra telefono/email/PEC", tipo: "booleano", predefinito: false },
      { chiave: "mostraIban", etichetta: "Mostra l'IBAN", tipo: "booleano", predefinito: false },
      { chiave: "mostraRegimeFiscale", etichetta: "Mostra il regime fiscale", tipo: "booleano", predefinito: false },
    ],
  },
  {
    tipo: "titolo",
    etichetta: "Titolo del documento",
    descrizione: "Numero, revisione e oggetto",
    ambiti: ["PREVENTIVO", "CONTRATTO"],
    unico: true,
    campi: [
      { chiave: "prefisso", etichetta: "Testo prima del numero", tipo: "testo", predefinito: "" },
      { chiave: "mostraRevisione", etichetta: "Mostra la revisione", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "destinatario",
    etichetta: "Destinatario",
    descrizione: "Dati del cliente e referente",
    ambiti: ["PREVENTIVO"],
    unico: true,
    campi: [
      { chiave: "mostraPartitaIva", etichetta: "Mostra la partita IVA", tipo: "booleano", predefinito: true },
      { chiave: "mostraReferente", etichetta: "Mostra il referente", tipo: "booleano", predefinito: true },
      { chiave: "mostraDate", etichetta: "Mostra data e validità", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "parti",
    etichetta: "Le parti",
    descrizione: "Prestatore e committente affiancati",
    ambiti: ["CONTRATTO"],
    unico: true,
    campi: [
      { chiave: "etichettaPrima", etichetta: "Etichetta a sinistra", tipo: "testo", predefinito: "TRA" },
      { chiave: "etichettaSeconda", etichetta: "Etichetta a destra", tipo: "testo", predefinito: "E" },
    ],
  },
  {
    tipo: "testo",
    etichetta: "Blocco di testo",
    descrizione: "Premessa, oggetto o clausole del documento",
    ambiti: ["PREVENTIVO", "CONTRATTO"],
    campi: [
      {
        chiave: "campo",
        etichetta: "Quale testo",
        tipo: "scelta",
        predefinito: "premessa",
        opzioni: [
          { valore: "premessa", etichetta: "Premessa" },
          { valore: "oggetto", etichetta: "Oggetto" },
          { valore: "condizioniPagamento", etichetta: "Condizioni di pagamento" },
          { valore: "condizioniServizio", etichetta: "Condizioni di servizio" },
          { valore: "tempiConsegna", etichetta: "Tempi di consegna" },
          { valore: "modalitaPagamento", etichetta: "Modalità di pagamento" },
          { valore: "note", etichetta: "Note" },
        ],
      },
      { chiave: "titolo", etichetta: "Titoletto", tipo: "testo", predefinito: "", nota: "Vuoto = nessun titoletto" },
      { chiave: "giustificato", etichetta: "Testo giustificato", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "voci",
    etichetta: "Tabella delle voci",
    descrizione: "Righe del preventivo con quantità e prezzi",
    ambiti: ["PREVENTIVO"],
    unico: true,
    campi: [
      { chiave: "mostraUnita", etichetta: "Colonna unità di misura", tipo: "booleano", predefinito: true },
      { chiave: "mostraSconto", etichetta: "Colonna sconto", tipo: "booleano", predefinito: true },
      { chiave: "mostraNote", etichetta: "Note sotto le voci", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "riepilogo",
    etichetta: "Riepilogo economico",
    descrizione: "Imponibile, IVA e totale",
    ambiti: ["PREVENTIVO"],
    unico: true,
    campi: [
      { chiave: "mostraSconti", etichetta: "Dettaglia gli sconti", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "bollo",
    etichetta: "Marca da bollo",
    descrizione: "Avviso di imposta di bollo oltre una soglia, per i regimi che ne sono esenti IVA",
    ambiti: ["PREVENTIVO"],
    unico: true,
    campi: [
      {
        chiave: "soglia",
        etichetta: "Soglia (0 = usa quella delle impostazioni)",
        tipo: "numero",
        predefinito: 0,
        nota: "Lasciare 0 per usare la soglia configurata nelle impostazioni dello studio",
      },
    ],
  },
  {
    tipo: "corrispettivo",
    etichetta: "Corrispettivo e durata",
    descrizione: "Canone, periodicità, decorrenza e rinnovo",
    ambiti: ["CONTRATTO"],
    unico: true,
    campi: [
      { chiave: "mostraMonteOre", etichetta: "Mostra il monte ore", tipo: "booleano", predefinito: true },
    ],
  },
  {
    tipo: "firme",
    etichetta: "Spazio per le firme",
    descrizione: "Due righe di firma con le ragioni sociali",
    ambiti: ["CONTRATTO"],
    unico: true,
    campi: [
      { chiave: "etichettaPrima", etichetta: "Etichetta a sinistra", tipo: "testo", predefinito: "Il prestatore" },
      { chiave: "etichettaSeconda", etichetta: "Etichetta a destra", tipo: "testo", predefinito: "Il committente" },
    ],
  },
  {
    tipo: "spazio",
    etichetta: "Spaziatura",
    descrizione: "Spazio verticale fra due blocchi",
    ambiti: ["PREVENTIVO", "CONTRATTO"],
    campi: [
      { chiave: "altezza", etichetta: "Altezza in punti", tipo: "numero", predefinito: 20 },
    ],
  },
  {
    tipo: "separatore",
    etichetta: "Linea separatrice",
    descrizione: "Riga orizzontale a tutta larghezza",
    ambiti: ["PREVENTIVO", "CONTRATTO"],
    campi: [],
  },
];

export function definizioneBlocco(tipo: string) {
  return CATALOGO_BLOCCHI.find((b) => b.tipo === tipo);
}

export function configPredefinitaBlocco(tipo: string) {
  const d = definizioneBlocco(tipo);
  if (!d) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const c of d.campi) out[c.chiave] = c.predefinito;
  return out;
}

/** Modello iniziale per un ambito, usato quando non ne esiste ancora uno. */
export function modelloPredefinito(ambito: "PREVENTIVO" | "CONTRATTO"): BloccoPdf[] {
  const tipi =
    ambito === "PREVENTIVO"
      ? ["intestazione", "titolo", "destinatario", "testo", "voci", "riepilogo", "bollo", "testo"]
      : ["intestazione", "titolo", "parti", "testo", "testo", "corrispettivo", "testo", "firme"];

  return tipi.map((tipo, i) => {
    const config = configPredefinitaBlocco(tipo);
    // I blocchi di testo ripetuti puntano a campi diversi, altrimenti
    // stamperebbero due volte la stessa cosa.
    if (tipo === "testo") {
      if (ambito === "PREVENTIVO") {
        config.campo = i < 5 ? "premessa" : "modalitaPagamento";
        config.titolo = i < 5 ? "" : "Condizioni";
      } else {
        const ordine = ["premessa", "oggetto", "condizioniPagamento"];
        const usati = tipi.slice(0, i).filter((t) => t === "testo").length;
        config.campo = ordine[usati] ?? "note";
        config.titolo =
          config.campo === "premessa" ? "Premessa"
          : config.campo === "oggetto" ? "Oggetto"
          : "Condizioni di pagamento";
      }
    }
    return { id: `b${i}`, tipo, attivo: true, config };
  });
}
