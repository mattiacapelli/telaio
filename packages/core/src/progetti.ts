import { z } from "zod";

/**
 * Modulo Progetti: vocabolari e regole di validazione, senza I/O.
 * Gli stessi elenchi alimentano gli enum del database, i form e le etichette dell'interfaccia.
 */

export const CATEGORIE_PROGETTO = [
  "software",
  "sito_web",
  "ecommerce",
  "infrastruttura",
  "consulenza",
  "altro",
] as const;
export type CategoriaProgetto = (typeof CATEGORIE_PROGETTO)[number];

export const STATI_PROGETTO = [
  "pianificato",
  "in_corso",
  "in_attesa",
  "completato",
  "annullato",
] as const;
export type StatoProgetto = (typeof STATI_PROGETTO)[number];

export const PRIORITA_PROGETTO = ["bassa", "normale", "alta", "urgente"] as const;
export type PrioritaProgetto = (typeof PRIORITA_PROGETTO)[number];

export const TIPI_RISORSA = [
  "repository",
  "design",
  "production",
  "staging",
  "documentation",
  "infrastructure",
  "monitoring",
  "other",
] as const;
export type TipoRisorsa = (typeof TIPI_RISORSA)[number];

export const AMBIENTI_RISORSA = ["development", "staging", "production"] as const;
export type AmbienteRisorsa = (typeof AMBIENTI_RISORSA)[number];

export const ETICHETTE_CATEGORIA: Record<CategoriaProgetto, string> = {
  software: "Software",
  sito_web: "Sito web",
  ecommerce: "E-commerce",
  infrastruttura: "Infrastruttura",
  consulenza: "Consulenza",
  altro: "Altro",
};
export const ETICHETTE_STATO_PROGETTO: Record<StatoProgetto, string> = {
  pianificato: "Pianificato",
  in_corso: "In corso",
  in_attesa: "In attesa",
  completato: "Completato",
  annullato: "Annullato",
};
export const ETICHETTE_PRIORITA: Record<PrioritaProgetto, string> = {
  bassa: "Bassa",
  normale: "Normale",
  alta: "Alta",
  urgente: "Urgente",
};
export const ETICHETTE_TIPO_RISORSA: Record<TipoRisorsa, string> = {
  repository: "Repository",
  design: "Design",
  production: "Produzione",
  staging: "Staging",
  documentation: "Documentazione",
  infrastructure: "Infrastruttura",
  monitoring: "Monitoraggio",
  other: "Altro",
};
export const ETICHETTE_AMBIENTE: Record<AmbienteRisorsa, string> = {
  development: "Sviluppo",
  staging: "Staging",
  production: "Produzione",
};

// ── Campi condivisi ──────────────────────────────────────────────────────────────────────────

const testoOpzionale = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Al massimo ${max} caratteri`)
    .nullish()
    .transform((v) => (v ? v : null));

const dataOpzionale = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
    message: "Data non valida",
  });

/** Lascia i form inviare una stringa vuota dove non c'è scelta: vuoto → undefined. */
const vuotoComeAssente = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// ── Progetto ─────────────────────────────────────────────────────────────────────────────────

/** I dati del progetto che l'utente compila; cliente e preventivo si risolvono a parte. */
export const progettoDatiSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, "Scrivi il nome del progetto")
      .max(200, "Al massimo 200 caratteri"),
    descrizione: testoOpzionale(5000),
    categoria: z.preprocess(vuotoComeAssente, z.enum(CATEGORIE_PROGETTO).default("altro")),
    stato: z.preprocess(vuotoComeAssente, z.enum(STATI_PROGETTO).default("pianificato")),
    priorita: z.preprocess(vuotoComeAssente, z.enum(PRIORITA_PROGETTO).default("normale")),
    responsabileId: testoOpzionale(100),
    dataInizioPrevista: dataOpzionale,
    dataFinePrevista: dataOpzionale,
  })
  .refine(
    (v) =>
      !v.dataInizioPrevista || !v.dataFinePrevista || v.dataFinePrevista >= v.dataInizioPrevista,
    { path: ["dataFinePrevista"], message: "La fine non può precedere l'inizio" },
  );
export type ProgettoDati = z.infer<typeof progettoDatiSchema>;

export interface DateEffettive {
  dataInizioEffettiva: string | null;
  dataFineEffettiva: string | null;
}

/**
 * Le date effettive seguono lo stato: il primo passaggio a «in corso» (o direttamente a
 * «completato») fissa l'inizio, «completato» fissa la fine, e riaprire un progetto completato
 * cancella la fine. Le date già presenti non si sovrascrivono.
 */
export function dateEffettiveDaStato(
  stato: StatoProgetto,
  attuali: DateEffettive,
  oggi: string,
): DateEffettive {
  let { dataInizioEffettiva, dataFineEffettiva } = attuali;
  if ((stato === "in_corso" || stato === "completato") && !dataInizioEffettiva)
    dataInizioEffettiva = oggi;
  if (stato === "completato") dataFineEffettiva ??= oggi;
  else dataFineEffettiva = null;
  return { dataInizioEffettiva, dataFineEffettiva };
}

// ── Risorse ──────────────────────────────────────────────────────────────────────────────────

/** Solo http/https e nessuna credenziale incorporata nell'indirizzo. */
export function urlRisorsaValido(valore: string): boolean {
  let u: URL;
  try {
    u = new URL(valore);
  } catch {
    return false;
  }
  return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password;
}

export const risorsaSchema = z.object({
  tipo: z.enum(TIPI_RISORSA, "Scegli il tipo di risorsa"),
  titolo: z.string().trim().min(1, "Scrivi il titolo").max(200, "Al massimo 200 caratteri"),
  url: z
    .string()
    .trim()
    .min(1, "Scrivi l'indirizzo")
    .max(2000, "Indirizzo troppo lungo")
    .refine(urlRisorsaValido, {
      message: "Usa un indirizzo http o https, senza nome utente e password",
    }),
  descrizione: testoOpzionale(1000),
  ambiente: z
    .preprocess(vuotoComeAssente, z.enum(AMBIENTI_RISORSA).nullish())
    .transform((v) => v ?? null),
  principale: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});
export type RisorsaDati = z.infer<typeof risorsaSchema>;
