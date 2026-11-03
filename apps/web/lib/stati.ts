export const STATO_PREVENTIVO: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "orange" | "ink" | "green" }
> = {
  bozza: { label: "Bozza", tone: "neutral" },
  inviato: { label: "Inviato", tone: "blue" },
  in_revisione: { label: "In revisione", tone: "orange" },
  accettato: { label: "Accettato", tone: "green" },
  accettato_parzialmente: { label: "Accettato parzialmente", tone: "orange" },
  rifiutato: { label: "Rifiutato", tone: "ink" },
  scaduto: { label: "Scaduto", tone: "orange" },
};

export const STATO_FATTURA: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "orange" | "ink" | "green" }
> = {
  bozza: { label: "Bozza", tone: "neutral" },
  emessa: { label: "Emessa", tone: "blue" },
  inviata_sdi: { label: "Inviata a SDI", tone: "blue" },
  consegnata: { label: "Consegnata", tone: "blue" },
  scartata: { label: "Scartata", tone: "orange" },
  parzialmente_pagata: { label: "Parzialmente pagata", tone: "orange" },
  pagata: { label: "Pagata", tone: "green" },
};

export const STATO_ABBONAMENTO: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "orange" | "ink" | "green" }
> = {
  attivo: { label: "Attivo", tone: "green" },
  sospeso: { label: "Sospeso", tone: "orange" },
  cessato: { label: "Cessato", tone: "ink" },
};

export const STATO_RATA: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "orange" | "ink" | "green" }
> = {
  da_incassare: { label: "Da incassare", tone: "blue" },
  parziale: { label: "Parziale", tone: "orange" },
  incassata: { label: "Incassata", tone: "green" },
  scaduta: { label: "Scaduta", tone: "orange" },
  annullata: { label: "Annullata", tone: "ink" },
};

type VarianteStato = "neutral" | "brand" | "ok" | "warn" | "bad";

export const STATO_PROGETTO: Record<string, { label: string; variante: VarianteStato }> = {
  pianificato: { label: "Pianificato", variante: "neutral" },
  in_corso: { label: "In corso", variante: "brand" },
  in_attesa: { label: "In attesa", variante: "warn" },
  completato: { label: "Completato", variante: "ok" },
  annullato: { label: "Annullato", variante: "bad" },
};

export const PRIORITA_PROGETTO: Record<string, { label: string; variante: VarianteStato }> = {
  bassa: { label: "Bassa", variante: "neutral" },
  normale: { label: "Normale", variante: "brand" },
  alta: { label: "Alta", variante: "warn" },
  urgente: { label: "Urgente", variante: "bad" },
};
