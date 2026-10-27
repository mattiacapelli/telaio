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
