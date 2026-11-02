import type { Cliente, Opportunita, Persona, RicercaClienti, TwentyClient } from "./types";

const CLIENTI: Cliente[] = [
  {
    id: "demo-1",
    nome: "Trattoria Da Marco",
    partitaIva: "01234567890",
    codiceFiscale: null,
    pec: "trattoria@pec.it",
    codiceSdi: "KRRH6B9",
    pa: false,
    citta: "Bergamo",
    sito: "trattoriadamarco.it",
  },
  {
    id: "demo-2",
    nome: "Comune di Esempio",
    partitaIva: null,
    codiceFiscale: "80012345678",
    pec: "protocollo@pec.comune.esempio.it",
    codiceSdi: "UFABC1",
    pa: true,
    citta: "Esempio",
    sito: null,
  },
  {
    id: "demo-3",
    nome: "Officine Rota S.r.l.",
    partitaIva: "09876543210",
    codiceFiscale: "09876543210",
    pec: "rota@pec.it",
    codiceSdi: "M5UXCR1",
    pa: false,
    citta: "Dalmine",
    sito: "officinerota.it",
  },
  {
    id: "demo-4",
    nome: "Studio Legale Bianchi",
    partitaIva: "04455667788",
    codiceFiscale: null,
    pec: null,
    codiceSdi: "0000000",
    pa: false,
    citta: "Milano",
    sito: null,
  },
];

const PERSONE: Record<string, Persona[]> = {
  "demo-1": [
    {
      id: "p-1",
      nome: "Marco Rossi",
      email: "marco@trattoriadamarco.it",
      telefono: "+39 035 000000",
      ruolo: "Titolare",
    },
  ],
  "demo-3": [
    {
      id: "p-2",
      nome: "Laura Rota",
      email: "laura@officinerota.it",
      telefono: null,
      ruolo: "Amministrazione",
    },
  ],
};

const OPPORTUNITA: Opportunita[] = [
  {
    id: "o-1",
    nome: "Sito vetrina + prenotazioni",
    fase: "PROPOSTA",
    importoCent: 120000,
    companyId: "demo-1",
  },
  {
    id: "o-2",
    nome: "Gestionale interno",
    fase: "QUALIFICATA",
    importoCent: 450000,
    companyId: "demo-3",
  },
];

/** Usato quando TWENTY_API_URL non è impostato. */
export function creaClientFinto(): TwentyClient {
  return {
    finto: true,
    async elencaClienti({ testo, limite = 50 }: RicercaClienti = {}) {
      const t = testo?.trim().toLowerCase();
      return CLIENTI.filter((c) => !t || c.nome.toLowerCase().includes(t)).slice(0, limite);
    },
    async dettaglioCliente(id) {
      return CLIENTI.find((c) => c.id === id) ?? null;
    },
    async elencaPersone(companyId) {
      return PERSONE[companyId] ?? [];
    },
    async elencaOpportunita(companyId) {
      return OPPORTUNITA.filter((o) => !companyId || o.companyId === companyId);
    },
    async aggiornaFaseOpportunita() {},
    async allegaPdf() {},
  };
}

/**
 * Produzione senza Twenty collegato: nessun cliente e nessuna opportunità, mai dati di esempio.
 * Con i dati finti un preventivo potrebbe finire intestato a un cliente inventato.
 */
export function creaClientVuoto(): TwentyClient {
  return {
    finto: true,
    async elencaClienti() {
      return [];
    },
    async dettaglioCliente() {
      return null;
    },
    async elencaPersone() {
      return [];
    },
    async elencaOpportunita() {
      return [];
    },
    async aggiornaFaseOpportunita() {},
    async allegaPdf() {},
  };
}
