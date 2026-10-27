export interface VoceNav {
  numero: string;
  titolo: string;
  href: string;
}

export const GRUPPI_NAV: { titolo: string; voci: VoceNav[] }[] = [
  {
    titolo: "Commerciale",
    voci: [
      { numero: "01", titolo: "Dashboard", href: "/" },
      { numero: "02", titolo: "Clienti", href: "/clienti" },
      { numero: "03", titolo: "Preventivi", href: "/preventivi" },
      { numero: "04", titolo: "Configuratore", href: "/configuratore" },
      { numero: "05", titolo: "Listini", href: "/listini" },
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
      { numero: "13", titolo: "Report ed export", href: "/report" },
    ],
  },
  {
    titolo: "Sistema",
    voci: [
      { numero: "14", titolo: "Impostazioni", href: "/impostazioni/ragioni-sociali" },
      { numero: "15", titolo: "Azioni in attesa", href: "/azioni-in-attesa" },
    ],
  },
];

export const AZIONI_PRINCIPALI: Record<string, { label: string; href: string }> = {
  "/preventivi": { label: "Nuovo preventivo", href: "/preventivi/nuovo" },
  "/configuratore": { label: "Nuovo preventivo", href: "/configuratore" },
  "/fatture": { label: "Nuova fattura", href: "/fatture/nuova" },
  "/incassi": { label: "Registra incasso", href: "/incassi" },
  "/abbonamenti": { label: "Nuovo abbonamento", href: "/abbonamenti" },
};

export const AZIONE_DEFAULT = { label: "Nuovo preventivo", href: "/configuratore" };

export const SEZIONI_IMPOSTAZIONI = [
  { slug: "ragioni-sociali", titolo: "Ragioni sociali", gruppo: "Azienda" },
  { slug: "iva", titolo: "IVA e fiscale", gruppo: "Azienda" },
  { slug: "listini", titolo: "Listini e moduli", gruppo: "Commerciale" },
  { slug: "fatturazione-elettronica", titolo: "Fatturazione elettronica", gruppo: "Documenti" },
  { slug: "modelli-pdf", titolo: "Modelli PDF", gruppo: "Documenti" },
  { slug: "email", titolo: "Email e mittenti", gruppo: "Documenti" },
  { slug: "twenty", titolo: "Twenty CRM", gruppo: "Integrazioni" },
  { slug: "pagamenti", titolo: "Pagamenti", gruppo: "Integrazioni" },
  { slug: "mcp", titolo: "MCP", gruppo: "Integrazioni" },
  { slug: "api", titolo: "API e webhook", gruppo: "Integrazioni" },
  { slug: "sicurezza", titolo: "Profilo e sicurezza", gruppo: "Account" },
  { slug: "dati", titolo: "Backup ed export dati", gruppo: "Account" },
] as const;
