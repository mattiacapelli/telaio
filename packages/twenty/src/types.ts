import { z } from "zod";

/** Cliente come lo usa Telaio, indipendente dalla forma dei dati di Twenty. */
export const clienteSchema = z.object({
  id: z.string(),
  nome: z.string(),
  partitaIva: z.string().nullable(),
  codiceFiscale: z.string().nullable(),
  pec: z.string().nullable(),
  codiceSdi: z.string().nullable(),
  pa: z.boolean(),
  citta: z.string().nullable(),
  sito: z.string().nullable(),
});
export type Cliente = z.infer<typeof clienteSchema>;

export const personaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  ruolo: z.string().nullable(),
});
export type Persona = z.infer<typeof personaSchema>;

export const opportunitaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  fase: z.string().nullable(),
  importoCent: z.number().nullable(),
  companyId: z.string().nullable(),
});
export type Opportunita = z.infer<typeof opportunitaSchema>;

export interface RicercaClienti {
  testo?: string;
  limite?: number;
}

/** Interfaccia unica: client reale e client finto la rispettano entrambi. */
export interface TwentyClient {
  readonly finto: boolean;
  elencaClienti(ricerca?: RicercaClienti): Promise<Cliente[]>;
  dettaglioCliente(id: string): Promise<Cliente | null>;
  elencaPersone(companyId: string): Promise<Persona[]>;
  elencaOpportunita(companyId?: string): Promise<Opportunita[]>;
  /** Scrittura ammessa 1: fase dell'opportunità */
  aggiornaFaseOpportunita(id: string, fase: string): Promise<void>;
  /** Scrittura ammessa 2: allegato PDF nella timeline (da implementare) */
  allegaPdf(opts: { companyId?: string; opportunityId?: string; nomeFile: string; contenuto: Uint8Array }): Promise<void>;
}
