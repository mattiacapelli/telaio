import { z } from "zod";
import { PRIORITA_PROGETTO } from "./progetti";

/**
 * Ticket di un progetto e kanban: vocabolari e regole di validazione, senza I/O.
 * Lo stato del ticket è separato dallo stato del progetto: i due non si influenzano.
 */

export const TIPI_TICKET = ["attivita", "bug", "richiesta", "assistenza"] as const;
export type TipoTicket = (typeof TIPI_TICKET)[number];

/** Le colonne della lavagna, nell'ordine in cui si leggono. Si passa liberamente dall'una all'altra. */
export const STATI_TICKET = [
  "backlog",
  "da_fare",
  "in_corso",
  "in_revisione",
  "completato",
] as const;
export type StatoTicket = (typeof STATI_TICKET)[number];

/** Stessa scala delle priorità dei progetti. */
export const PRIORITA_TICKET = PRIORITA_PROGETTO;

export const ETICHETTE_TIPO_TICKET: Record<TipoTicket, string> = {
  attivita: "Attività",
  bug: "Bug",
  richiesta: "Richiesta",
  assistenza: "Assistenza",
};
export const ETICHETTE_STATO_TICKET: Record<StatoTicket, string> = {
  backlog: "Backlog",
  da_fare: "Da fare",
  in_corso: "In corso",
  in_revisione: "In revisione",
  completato: "Completato",
};

const testoOpzionale = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Al massimo ${max} caratteri`)
    .nullish()
    .transform((v) => (v ? v : null));

const vuotoComeAssente = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const scadenzaOpzionale = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
    message: "Data non valida",
  });

export const ticketDatiSchema = z.object({
  titolo: z
    .string()
    .trim()
    .min(1, "Scrivi il titolo del ticket")
    .max(200, "Al massimo 200 caratteri"),
  descrizione: testoOpzionale(10000),
  tipo: z.preprocess(vuotoComeAssente, z.enum(TIPI_TICKET).default("attivita")),
  stato: z.preprocess(vuotoComeAssente, z.enum(STATI_TICKET).default("da_fare")),
  priorita: z.preprocess(vuotoComeAssente, z.enum(PRIORITA_TICKET).default("normale")),
  assegnatarioId: testoOpzionale(100),
  scadenza: scadenzaOpzionale,
});
export type TicketDati = z.infer<typeof ticketDatiSchema>;

export const commentoTicketSchema = z.object({
  testo: z.string().trim().min(1, "Scrivi il commento").max(5000, "Al massimo 5000 caratteri"),
});

/** Codice leggibile di un ticket: quello del progetto più il numero progressivo («PRJ-2026-001-7»). */
export const codiceTicket = (codiceProgetto: string, numero: number) =>
  `${codiceProgetto}-${numero}`;

/** Distanza tra due posizioni consecutive in una colonna appena riordinata. */
export const PASSO_POSIZIONE = 1000;
/** Sotto questa distanza due posizioni non si possono più dividere: la colonna va riordinata. */
export const DISTANZA_MINIMA = 1e-6;

/**
 * Posizione di un ticket inserito tra due vicini della colonna (`prima` sopra, `dopo` sotto;
 * `null` dove non c'è nessuno). Restituisce `null` se tra i due non c'è più spazio.
 */
export function posizioneTra(prima: number | null, dopo: number | null): number | null {
  if (prima === null && dopo === null) return PASSO_POSIZIONE;
  if (prima === null) return (dopo as number) - PASSO_POSIZIONE;
  if (dopo === null) return prima + PASSO_POSIZIONE;
  if (dopo - prima < DISTANZA_MINIMA * 2) return null;
  return (prima + dopo) / 2;
}
