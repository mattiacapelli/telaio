export const STATO_PREVENTIVO: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "orange" | "ink" | "green" }
> = {
  bozza: { label: "Bozza", tone: "neutral" },
  inviato: { label: "Inviato", tone: "blue" },
  in_revisione: { label: "In revisione", tone: "orange" },
  accettato: { label: "Accettato", tone: "green" },
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
