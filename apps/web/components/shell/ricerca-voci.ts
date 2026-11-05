import {
  ArrowLeftRight,
  Banknote,
  FilePlus2,
  FolderPlus,
  Inbox,
  type LucideIcon,
  Monitor,
  Moon,
  Receipt,
  Repeat,
  Settings,
  Sun,
  Wallet,
} from "lucide-react";
import { GRUPPI_NAV, SEZIONI_DISATTIVATE, SEZIONI_IMPOSTAZIONI } from "@/lib/nav";
import type { Tema } from "@/lib/tema";
import { ICONE_NAV } from "./nav-icone";

/** Ciò che si può fare dalla barra «Cerca» oltre a trovare i contenuti: azioni, pagine, impostazioni. */
export type GruppoFunzione = "Azioni" | "Pagine" | "Impostazioni" | "Preferenze";

export interface Funzione {
  id: string;
  gruppo: GruppoFunzione;
  titolo: string;
  sottotitolo?: string;
  icona: LucideIcon;
  parole: readonly string[];
  /** pagina da aprire */
  href?: string;
  /** oppure cambio di tema */
  tema?: Tema;
}

const AZIONI: Funzione[] = [
  {
    id: "azione-incasso",
    gruppo: "Azioni",
    titolo: "Registra incasso",
    sottotitolo: "Bonifico, contante o carta",
    icona: Banknote,
    parole: ["pagamento", "incassare", "soldi", "ricevuto"],
    href: "/incassi",
  },
  {
    id: "azione-preventivo",
    gruppo: "Azioni",
    titolo: "Nuovo preventivo",
    sottotitolo: "Dal listino o con righe libere",
    icona: FilePlus2,
    parole: ["crea", "offerta", "preventivare"],
    href: "/preventivi/nuovo",
  },
  {
    id: "azione-progetto",
    gruppo: "Azioni",
    titolo: "Nuovo progetto",
    sottotitolo: "Una commessa per un cliente",
    icona: FolderPlus,
    parole: ["crea", "commessa", "lavoro"],
    href: "/progetti/nuovo",
  },
  {
    id: "azione-fattura",
    gruppo: "Azioni",
    titolo: "Nuova fattura",
    sottotitolo: "Libera, anche per privati",
    icona: Receipt,
    parole: ["crea", "emetti", "fatturare"],
    href: "/fatture/nuova",
  },
  {
    id: "azione-abbonamento",
    gruppo: "Azioni",
    titolo: "Nuovo abbonamento",
    sottotitolo: "Canone ricorrente",
    icona: Repeat,
    parole: ["crea", "canone", "ricorrente"],
    href: "/abbonamenti",
  },
  {
    id: "azione-spesa",
    gruppo: "Azioni",
    titolo: "Registra spesa",
    sottotitolo: "Prima nota",
    icona: Wallet,
    parole: ["uscita", "costo", "movimento"],
    href: "/prima-nota",
  },
  {
    id: "azione-giroconto",
    gruppo: "Azioni",
    titolo: "Giroconto",
    sottotitolo: "Sposta soldi tra conti",
    icona: ArrowLeftRight,
    parole: ["trasferimento", "prelievo", "versamento"],
    href: "/prima-nota",
  },
  {
    id: "azione-in-attesa",
    gruppo: "Azioni",
    titolo: "Azioni in attesa di conferma",
    sottotitolo: "Proposte da AI e API",
    icona: Inbox,
    parole: ["approva", "conferma", "coda"],
    href: "/azioni-in-attesa",
  },
];

const PAROLE_PAGINA: Record<string, readonly string[]> = {
  "/": ["home", "panoramica", "riepilogo"],
  "/clienti": ["anagrafica", "twenty", "contatti", "aziende"],
  "/preventivi": ["offerte", "proposte"],
  "/progetti": ["commesse", "lavori"],
  "/ticket": ["kanban", "lavagna", "attività", "bug", "richieste", "assistenza", "task"],
  "/listini": ["prezzi", "moduli", "basi", "voci"],
  "/fatture": ["fatturazione", "emesse"],
  "/incassi": ["pagamenti", "entrate", "versamenti"],
  "/scadenzario": ["rate", "scadenze", "solleciti", "da incassare"],
  "/abbonamenti": ["canoni", "ricorrenti", "rinnovi"],
  "/prima-nota": ["movimenti", "spese", "uscite", "entrate"],
  "/conti": ["banca", "cassa", "saldi", "carta"],
  "/cash-flow": ["liquidità", "previsioni", "flusso di cassa"],
  "/report": ["export", "csv", "esporta", "statistiche"],
  "/azioni-in-attesa": ["approva", "conferma", "coda"],
};

const PAROLE_IMPOSTAZIONE: Record<string, readonly string[]> = {
  "ragioni-sociali": ["emittente", "partita iva", "azienda", "numerazione", "logo"],
  iva: ["aliquota", "bollo", "forfettario", "regime", "fiscale", "tasse"],
  listini: ["prezzi", "moduli", "basi"],
  "fatturazione-elettronica": ["sdi", "xml", "sdi", "elettronica"],
  "modelli-pdf": ["pdf", "layout", "stile", "documenti", "intestazione"],
  email: ["smtp", "mittente", "firma", "posta", "invio"],
  ticket: ["assegnazione", "assegna", "automatica", "kanban", "lavagna"],
  archiviazione: ["s3", "bucket", "minio", "file", "documenti", "storage", "cloud"],
  twenty: ["crm", "integrazione", "api key"],
  pagamenti: ["stripe", "carta", "link"],
  mcp: ["ai", "claude", "assistente", "agente"],
  api: ["webhook", "token", "chiavi", "integrazione"],
  sicurezza: ["password", "2fa", "due fattori", "profilo", "account", "sessioni"],
  dati: ["backup", "export", "esporta", "scarica"],
};

const PAGINE: Funzione[] = GRUPPI_NAV.flatMap((g) => g.voci).map((v) => ({
  id: `pagina-${v.href}`,
  gruppo: "Pagine" as const,
  titolo: v.titolo,
  icona: ICONE_NAV[v.href] ?? Settings,
  parole: PAROLE_PAGINA[v.href] ?? [],
  href: v.href,
}));

const IMPOSTAZIONI: Funzione[] = SEZIONI_IMPOSTAZIONI.filter(
  (s) => !SEZIONI_DISATTIVATE.includes(s.slug),
).map((s) => ({
  id: `impostazioni-${s.slug}`,
  gruppo: "Impostazioni" as const,
  titolo: s.titolo,
  sottotitolo: `Impostazioni · ${s.gruppo}`,
  icona: Settings,
  parole: ["impostazioni", "configura", ...(PAROLE_IMPOSTAZIONE[s.slug] ?? [])],
  href: `/impostazioni/${s.slug}`,
}));

const PREFERENZE: Funzione[] = [
  { tema: "chiaro", titolo: "Tema chiaro", icona: Sun },
  { tema: "scuro", titolo: "Tema scuro", icona: Moon },
  { tema: "sistema", titolo: "Tema del dispositivo", icona: Monitor },
].map(({ tema, titolo, icona }) => ({
  id: `tema-${tema}`,
  gruppo: "Preferenze" as const,
  titolo,
  sottotitolo: "Aspetto dell'app",
  icona,
  parole: ["aspetto", "dark", "light", "colori", "modalità"],
  tema: tema as Tema,
}));

export const FUNZIONI: readonly Funzione[] = [...AZIONI, ...PAGINE, ...IMPOSTAZIONI, ...PREFERENZE];

export const GRUPPI_FUNZIONI: readonly GruppoFunzione[] = [
  "Azioni",
  "Pagine",
  "Impostazioni",
  "Preferenze",
];
