export interface VoceNav {
  numero: string;
  titolo: string;
  href: string;
}

export const GRUPPI_NAV: { titolo: string; voci: VoceNav[] }[] = [
  {
    titolo: "Commerciale",
    voci: [
      { numero: "01", titolo: "Clienti", href: "/clienti" },
      { numero: "02", titolo: "Preventivi", href: "/preventivi" },
      { numero: "03", titolo: "Configuratore", href: "/configuratore" },
      { numero: "04", titolo: "Listini", href: "/listini" },
      { numero: "05", titolo: "Azioni in attesa", href: "/azioni-in-attesa" },
    ],
  },
  {
    titolo: "Amministrazione",
    voci: [
      { numero: "06", titolo: "Fatture", href: "/fatture" },
      { numero: "07", titolo: "Incassi", href: "/incassi" },
      { numero: "08", titolo: "Scadenzario", href: "/scadenzario" },
      { numero: "09", titolo: "Abbonamenti", href: "/abbonamenti" },
      { numero: "10", titolo: "Prima nota", href: "/prima-nota" },
      { numero: "11", titolo: "Conti", href: "/conti" },
    ],
  },
  {
    titolo: "Analisi",
    voci: [
      { numero: "12", titolo: "Cash flow", href: "/cash-flow" },
      { numero: "13", titolo: "Report", href: "/report" },
    ],
  },
  {
    titolo: "Sistema",
    voci: [{ numero: "14", titolo: "Impostazioni", href: "/impostazioni/ragioni-sociali" }],
  },
];

export const AZIONI_PRINCIPALI: Record<string, { label: string; href: string }> = {
  "/preventivi": { label: "Nuovo preventivo", href: "/configuratore" },
  "/configuratore": { label: "Nuovo preventivo", href: "/configuratore" },
  "/fatture": { label: "Nuova fattura", href: "/fatture" },
  "/incassi": { label: "Registra incasso", href: "/incassi" },
  "/abbonamenti": { label: "Nuovo abbonamento", href: "/abbonamenti" },
};

export const AZIONE_DEFAULT = { label: "Nuovo preventivo", href: "/configuratore" };

export const SEZIONI_IMPOSTAZIONI = [
  { slug: "ragioni-sociali", titolo: "Ragioni sociali" },
  { slug: "iva", titolo: "IVA e fiscale" },
  { slug: "listini", titolo: "Listini e moduli" },
  { slug: "fatturazione-elettronica", titolo: "Fatturazione elettronica" },
  { slug: "modelli-pdf", titolo: "Modelli PDF" },
  { slug: "email", titolo: "Email e mittenti" },
  { slug: "twenty", titolo: "Twenty" },
  { slug: "pagamenti", titolo: "Pagamenti" },
  { slug: "mcp", titolo: "MCP" },
  { slug: "api", titolo: "API e webhook" },
  { slug: "sicurezza", titolo: "Profilo e sicurezza" },
  { slug: "dati", titolo: "Backup ed export" },
] as const;
