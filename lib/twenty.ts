import { prisma } from "./prisma";
import { invalidate } from "./redis";

/**
 * Client REST per Twenty CRM.
 *
 * I nomi dei campi rispecchiano il workspace reale: oltre ai campi standard
 * (name, address, domainName) sono presenti i campi custom italiani
 * piva / codiceFiscale / pec / codiceSdi / settore / statoRelazione.
 */

const SETTORE_IT: Record<string, string> = {
  MANUFACTURING: "Manifattura",
  IT_SOFTWARE: "Software",
  SERVICES: "Servizi",
  RETAIL: "Retail",
  HEALTHCARE: "Sanità",
  OTHER: "Altro",
};

export type TwentyCompany = {
  id: string;
  name: string;
  piva?: string | null;
  codiceFiscale?: string | null;
  pec?: string | null;
  codiceSdi?: string | null;
  settore?: string | null;
  statoRelazione?: string | null;
  address?: { addressCity?: string | null } | null;
};

export type TwentyPerson = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  jobTitle?: string | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  companyId?: string | null;
};

export function twentyConfigured() {
  return Boolean(process.env.TWENTY_API_KEY && process.env.TWENTY_API_URL);
}

async function twentyFetch<T>(path: string): Promise<T> {
  const base = (process.env.TWENTY_API_URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/rest/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.TWENTY_API_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Twenty ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function sigla(nome: string) {
  return nome
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Importa aziende e contatti da Twenty in Telaio.
 *
 * L'anagrafica è di sola lettura lato Telaio: la sincronizzazione è un upsert
 * su twentyId, quindi è idempotente e non duplica i record già importati.
 * I dati operativi (tariffa, progetti, ore) restano di Telaio e non vengono
 * toccati sugli aggiornamenti successivi.
 */
export async function syncFromTwenty() {
  if (!twentyConfigured()) {
    throw new Error(
      "Twenty non configurato: imposta TWENTY_API_URL e TWENTY_API_KEY in .env",
    );
  }

  const companies = await twentyFetch<{ data: { companies: TwentyCompany[] } }>(
    "companies?limit=100",
  );
  const people = await twentyFetch<{ data: { people: TwentyPerson[] } }>(
    "people?limit=100",
  );

  let aziende = 0;
  for (const c of companies.data.companies ?? []) {
    const settore = c.settore ? (SETTORE_IT[c.settore] ?? c.settore) : null;
    await prisma.cliente.upsert({
      where: { twentyId: c.id },
      // La tariffa oraria vive solo in Telaio: la impostiamo alla creazione e
      // non la sovrascriviamo più a ogni sync.
      create: {
        twentyId: c.id,
        ragioneSociale: c.name,
        sigla: sigla(c.name),
        settore,
        citta: c.address?.addressCity || null,
        partitaIva: c.piva || null,
        codiceFiscale: c.codiceFiscale || null,
        pec: c.pec || null,
        codiceSdi: c.codiceSdi || null,
        statoRelazione: c.statoRelazione ?? "CUSTOMER",
        tariffaOraria: 65,
        syncedAt: new Date(),
      },
      update: {
        ragioneSociale: c.name,
        sigla: sigla(c.name),
        settore,
        citta: c.address?.addressCity || null,
        partitaIva: c.piva || null,
        codiceFiscale: c.codiceFiscale || null,
        pec: c.pec || null,
        codiceSdi: c.codiceSdi || null,
        statoRelazione: c.statoRelazione ?? "CUSTOMER",
        syncedAt: new Date(),
      },
    });
    aziende++;
  }

  let contatti = 0;
  for (const p of people.data.people ?? []) {
    if (!p.companyId) continue;
    const cliente = await prisma.cliente.findUnique({
      where: { twentyId: p.companyId },
      select: { id: true },
    });
    if (!cliente) continue;

    const dati = {
      clienteId: cliente.id,
      nome: p.name?.firstName ?? "",
      cognome: p.name?.lastName ?? "",
      ruolo: p.jobTitle || null,
      email: p.emails?.primaryEmail || null,
      telefono: p.phones?.primaryPhoneNumber || null,
    };
    await prisma.referente.upsert({
      where: { twentyId: p.id },
      create: { twentyId: p.id, ...dati },
      update: dati,
    });
    contatti++;
  }

  await prisma.impostazioni.upsert({
    where: { id: 1 },
    create: { id: 1, twentySyncedAt: new Date() },
    update: { twentySyncedAt: new Date() },
  });

  await invalidate();
  return { aziende, contatti, at: new Date().toISOString() };
}
