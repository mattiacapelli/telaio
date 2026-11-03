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
      { numero: "04", titolo: "Progetti", href: "/progetti" },
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
  "/progetti": { label: "Nuovo progetto", href: "/progetti/nuovo" },
  "/fatture": { label: "Nuova fattura", href: "/fatture/nuova" },
  "/incassi": { label: "Registra incasso", href: "/incassi" },
  "/abbonamenti": { label: "Nuovo abbonamento", href: "/abbonamenti" },
};

export const AZIONE_DEFAULT = { label: "Nuovo preventivo", href: "/preventivi/nuovo" };

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

/** Sezioni previste ma non ancora disponibili: restano nel menu, non cliccabili. */
export const SEZIONI_DISATTIVATE: readonly string[] = ["fatturazione-elettronica", "pagamenti"];

export interface Briciola {
  label: string;
  href?: string;
}

const ETICHETTE_SEGMENTO: Record<string, string> = {
  nuova: "Nuova",
  nuovo: "Nuovo",
  modifica: "Modifica",
  "design-system": "Design system",
  "incasso-rapido": "Incasso al volo",
  "azioni-in-attesa": "Azioni in attesa",
};

/** Briciole di pane per l'intestazione, ricavate dal percorso. */
export function briciole(pathname: string): Briciola[] {
  const segmenti = pathname.split("/").filter(Boolean);
  if (segmenti.length === 0) return [{ label: "Dashboard" }];
  const voci = GRUPPI_NAV.flatMap((g) => g.voci);
  const base = `/${segmenti[0]}`;
  const voce = voci.find((v) => v.href === base || v.href.startsWith(`${base}/`));
  const primo: Briciola = {
    label: voce?.titolo ?? ETICHETTE_SEGMENTO[segmenti[0] ?? ""] ?? segmenti[0] ?? "",
    href: base,
  };
  if (segmenti[0] === "impostazioni") {
    const sezione = SEZIONI_IMPOSTAZIONI.find((s) => s.slug === segmenti[1]);
    return [
      { label: "Impostazioni", href: "/impostazioni/ragioni-sociali" },
      ...(sezione ? [{ label: sezione.titolo }] : []),
    ];
  }
  if (segmenti.length === 1) return [{ label: primo.label }];
  const secondo = segmenti[1] ?? "";
  const esteso = ETICHETTE_SEGMENTO[secondo] ?? "Dettaglio";
  return [primo, { label: esteso }];
}
