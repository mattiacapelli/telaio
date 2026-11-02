import { z } from "zod";
import { creaClientFinto, creaClientVuoto } from "./mock";
import type { Cliente, Opportunita, Persona, TwentyClient } from "./types";

export interface OpzioniTwenty {
  /** es. https://crm.example.com — se assente si usa il client finto */
  apiUrl?: string;
  apiKey?: string;
  /** nomi dei campi personalizzati su Company, se diversi dai default */
  campi?: Partial<Record<"partitaIva" | "codiceFiscale" | "pec" | "codiceSdi" | "pa", string>>;
}

const testo = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));
const link = z.object({ primaryLinkUrl: z.string().nullish() }).nullish();

const companyRaw = z
  .object({
    id: z.string(),
    name: z.string().nullish(),
    domainName: link,
    address: z.object({ addressCity: z.string().nullish() }).nullish(),
  })
  .passthrough();

const personRaw = z
  .object({
    id: z.string(),
    name: z.object({ firstName: z.string().nullish(), lastName: z.string().nullish() }).nullish(),
    emails: z.object({ primaryEmail: z.string().nullish() }).nullish(),
    phones: z.object({ primaryPhoneNumber: z.string().nullish() }).nullish(),
    jobTitle: testo,
  })
  .passthrough();

const opportunityRaw = z
  .object({
    id: z.string(),
    name: z.string().nullish(),
    stage: testo,
    amount: z.object({ amountMicros: z.union([z.number(), z.string()]).nullish() }).nullish(),
    companyId: testo,
  })
  .passthrough();

const lista = <T extends z.ZodType>(chiave: string, item: T) =>
  z.object({ data: z.record(z.string(), z.array(item)).transform((d) => d[chiave] ?? []) });

export function creaTwentyClient(opzioni: OpzioniTwenty = {}): TwentyClient {
  const base = opzioni.apiUrl?.replace(/\/$/, "");
  if (!base) return creaClientFinto();

  const campi = {
    partitaIva: "partitaIva",
    codiceFiscale: "codiceFiscale",
    pec: "pec",
    codiceSdi: "codiceSdi",
    pa: "pubblicaAmministrazione",
    ...opzioni.campi,
  };

  async function richiesta<T>(
    percorso: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${base}/rest${percorso}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${opzioni.apiKey ?? ""}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`Twenty ${res.status} su ${percorso}`);
    return schema.parse(await res.json());
  }

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  function mappaCliente(c: z.infer<typeof companyRaw>): Cliente {
    return {
      id: c.id,
      nome: c.name ?? "(senza nome)",
      partitaIva: str(c[campi.partitaIva]),
      codiceFiscale: str(c[campi.codiceFiscale]),
      pec: str(c[campi.pec]),
      codiceSdi: str(c[campi.codiceSdi]),
      pa: c[campi.pa] === true,
      citta: c.address?.addressCity ?? null,
      sito: c.domainName?.primaryLinkUrl ?? null,
    };
  }

  return {
    finto: false,
    async elencaClienti({ testo, limite = 50 } = {}) {
      const filtro = testo ? `&filter=${encodeURIComponent(`name[ilike]:"%${testo}%"`)}` : "";
      const r = await richiesta(
        `/companies?limit=${limite}${filtro}`,
        lista("companies", companyRaw),
      );
      return r.data.map(mappaCliente);
    },
    async dettaglioCliente(id) {
      try {
        const r = await richiesta(
          `/companies/${id}`,
          z.object({ data: z.object({ company: companyRaw }) }),
        );
        return mappaCliente(r.data.company);
      } catch {
        return null;
      }
    },
    async elencaPersone(companyId): Promise<Persona[]> {
      const filtro = encodeURIComponent(`companyId[eq]:"${companyId}"`);
      const r = await richiesta(`/people?filter=${filtro}`, lista("people", personRaw));
      return r.data.map((p) => ({
        id: p.id,
        nome: [p.name?.firstName, p.name?.lastName].filter(Boolean).join(" ") || "(senza nome)",
        email: p.emails?.primaryEmail ?? null,
        telefono: p.phones?.primaryPhoneNumber ?? null,
        ruolo: p.jobTitle,
      }));
    },
    async elencaOpportunita(companyId): Promise<Opportunita[]> {
      const filtro = companyId
        ? `?filter=${encodeURIComponent(`companyId[eq]:"${companyId}"`)}`
        : "";
      const r = await richiesta(`/opportunities${filtro}`, lista("opportunities", opportunityRaw));
      return r.data.map((o) => ({
        id: o.id,
        nome: o.name ?? "(senza nome)",
        fase: o.stage,
        importoCent:
          o.amount?.amountMicros != null ? Math.round(Number(o.amount.amountMicros) / 10000) : null,
        companyId: o.companyId,
      }));
    },
    async aggiornaFaseOpportunita(id, fase) {
      await richiesta(`/opportunities/${id}`, z.unknown(), {
        method: "PATCH",
        body: JSON.stringify({ stage: fase }),
      });
    },
    async allegaPdf() {
      // Da implementare: upload del file + creazione dell'allegato collegato a company/opportunity.
      throw new Error("allegaPdf non ancora implementato");
    },
  };
}

/** Client configurato dalle variabili d'ambiente. */
export function twentyDaEnv(env: Record<string, string | undefined> = process.env): TwentyClient {
  const apiUrl = env.TWENTY_API_URL || undefined;
  // In produzione mai i clienti di esempio: senza Twenty l'elenco è vuoto.
  if (!apiUrl && env.NODE_ENV === "production") return creaClientVuoto();
  return creaTwentyClient({ apiUrl, apiKey: env.TWENTY_API_KEY });
}
