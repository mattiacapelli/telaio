import { describe, expect, it } from "vitest";
import {
  ErroreAccettazione,
  erroreGruppi,
  nomeServizio,
  type RigaDecisione,
  sceltaTotale,
  servizi,
  totaliAccettazione,
  valoreRicorrenteAnnuo,
  valutaAccettazione,
} from "./accettazione";
import { puoTransirePreventivo, transizioniPreventivo } from "./preventivo";

const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const G = "11111111-1111-4111-8111-111111111111";

const riga = (
  n: number,
  tipo: RigaDecisione["tipo"],
  prezzo: number,
  over: Partial<RigaDecisione> = {},
): RigaDecisione => ({
  id: U(n),
  tipo,
  quantita: 1,
  prezzoUnitarioCent: prezzo,
  scontoBp: 0,
  gruppoAlternativaId: null,
  ...over,
});

/** Sito (1000), SEO (300), manutenzione annuale 600 oppure mensile 60 (gruppo), hosting 50/mese. */
const righe: RigaDecisione[] = [
  riga(1, "una_tantum", 100000),
  riga(2, "una_tantum", 30000),
  riga(3, "canone_annuo", 60000, { gruppoAlternativaId: G }),
  riga(4, "canone_mensile", 6000, { gruppoAlternativaId: G }),
  riga(5, "canone_mensile", 5000),
];
const regole = {
  ivaAttiva: true,
  aliquotaIvaBp: 2200,
  bolloAutomatico: false,
  splitPayment: false,
};

describe("stati del preventivo", () => {
  it("l'accettazione parziale si raggiunge da inviato e in revisione ed è finale", () => {
    expect(puoTransirePreventivo("inviato", "accettato_parzialmente")).toBe(true);
    expect(puoTransirePreventivo("in_revisione", "accettato_parzialmente")).toBe(true);
    expect(puoTransirePreventivo("bozza", "accettato_parzialmente")).toBe(false);
    expect(transizioniPreventivo("accettato_parzialmente")).toEqual([]);
    expect(transizioniPreventivo("accettato")).toEqual([]);
    expect(transizioniPreventivo("rifiutato")).toEqual([]);
  });
});

describe("servizi e gruppi", () => {
  it("un gruppo di alternative è un solo servizio", () => {
    const s = servizi(righe);
    expect(s).toHaveLength(4);
    expect(s.filter((x) => x.gruppo)).toHaveLength(1);
    expect(s.find((x) => x.gruppo)?.righe.map((r) => r.id)).toEqual([U(3), U(4)]);
  });
  it("rifiuta gruppi malformati", () => {
    expect(erroreGruppi(righe)).toBeNull();
    expect(
      erroreGruppi([
        riga(1, "una_tantum", 1, { gruppoAlternativaId: G }),
        righe[3] as RigaDecisione,
      ]),
    ).toMatch(/una tantum/);
    expect(erroreGruppi([righe[2] as RigaDecisione])).toMatch(/annuo e uno mensile/);
    expect(
      erroreGruppi([
        riga(3, "canone_mensile", 1, { gruppoAlternativaId: G }),
        riga(4, "canone_mensile", 2, { gruppoAlternativaId: G }),
      ]),
    ).toMatch(/annuo e uno mensile/);
  });
  it("nomeServizio toglie il suffisso del canone", () => {
    expect(nomeServizio("Manutenzione — canone annuo")).toBe("Manutenzione");
    expect(nomeServizio("Hosting - canone mensile")).toBe("Hosting");
    expect(nomeServizio("Assistenza")).toBe("Assistenza");
  });
});

describe("valutaAccettazione", () => {
  const tutto = { righe: [U(1), U(2), U(5)], gruppi: { [G]: U(3) } };

  it("accettato: tutti i servizi, con una modalità per ogni gruppo", () => {
    const v = valutaAccettazione(righe, tutto);
    expect(v.esito).toBe("accettato");
    expect([...v.decisioni.entries()].filter(([, s]) => s).map(([id]) => id)).toEqual([
      U(1),
      U(2),
      U(3),
      U(5),
    ]);
    expect(v.decisioni.get(U(4))).toBe(false);
  });
  it("la modalità alternativa non scelta non rende l'accettazione parziale", () => {
    expect(valutaAccettazione(righe, { ...tutto, gruppi: { [G]: U(4) } }).esito).toBe("accettato");
  });
  it("parziale: una prestazione esclusa (la SEO)", () => {
    const v = valutaAccettazione(righe, { righe: [U(1), U(5)], gruppi: { [G]: U(3) } });
    expect(v.esito).toBe("accettato_parzialmente");
    expect(v.decisioni.get(U(2))).toBe(false);
    expect(v.serviziEsclusi).toBe(1);
  });
  it("parziale: più prestazioni escluse", () => {
    const v = valutaAccettazione(righe, { righe: [U(1)], gruppi: { [G]: U(3) } });
    expect(v.esito).toBe("accettato_parzialmente");
    expect(v.serviziEsclusi).toBe(2);
  });
  it("parziale: un intero servizio ricorrente rifiutato (gruppo escluso)", () => {
    const v = valutaAccettazione(righe, { righe: [U(1), U(2), U(5)], gruppi: { [G]: null } });
    expect(v.esito).toBe("accettato_parzialmente");
    expect(v.decisioni.get(U(3))).toBe(false);
    expect(v.decisioni.get(U(4))).toBe(false);
  });
  it("rifiutato: nessuna prestazione né servizio", () => {
    expect(valutaAccettazione(righe, { righe: [], gruppi: { [G]: null } }).esito).toBe("rifiutato");
  });
  it("ogni riga riceve una decisione e al più una alternativa è vera", () => {
    const v = valutaAccettazione(righe, tutto);
    expect(v.decisioni.size).toBe(righe.length);
    expect(v.decisioni.get(U(3)) && v.decisioni.get(U(4))).toBe(false);
  });
  it("rifiuta le selezioni incoerenti", () => {
    // gruppo senza scelta esplicita
    expect(() => valutaAccettazione(righe, { righe: [U(1)], gruppi: {} })).toThrow(
      ErroreAccettazione,
    );
    // una riga del gruppo passata come indipendente
    expect(() => valutaAccettazione(righe, { righe: [U(1), U(3)], gruppi: { [G]: U(4) } })).toThrow(
      /dal suo gruppo/,
    );
    // riga estranea
    expect(() => valutaAccettazione(righe, { righe: [U(9)], gruppi: { [G]: null } })).toThrow(
      /estranee/,
    );
    // gruppo estraneo
    expect(() =>
      valutaAccettazione(righe, {
        righe: [],
        gruppi: { [G]: null, "22222222-2222-4222-8222-222222222222": null },
      }),
    ).toThrow(/gruppi estranei/);
    // alternativa che non appartiene al gruppo
    expect(() => valutaAccettazione(righe, { righe: [], gruppi: { [G]: U(5) } })).toThrow(
      /non appartiene/,
    );
  });
  it("sceltaTotale: accetta tutto, ma lascia da scegliere i gruppi", () => {
    const s = sceltaTotale(righe);
    expect(s.righe).toEqual([U(1), U(2), U(5)]);
    expect(valutaAccettazione(righe, s).esito).toBe("accettato_parzialmente");
    const senzaGruppi = righe.filter((r) => !r.gruppoAlternativaId);
    expect(valutaAccettazione(senzaGruppi, sceltaTotale(senzaGruppi)).esito).toBe("accettato");
  });
});

describe("totaliAccettazione", () => {
  it("i totali originali non cambiano e quelli accettati escludono le righe rifiutate", () => {
    const v = valutaAccettazione(righe, { righe: [U(1), U(5)], gruppi: { [G]: U(3) } });
    const t = totaliAccettazione(righe, v.decisioni, regole);
    expect(t.originali.imponibileCent).toBe(130000);
    expect(t.originali.ivaCent).toBe(28600);
    expect(t.accettati.imponibileCent).toBe(100000);
    expect(t.accettati.ivaCent).toBe(22000);
    expect(t.accettati.totaleCent).toBe(122000);
    expect(t.escluseCent).toBe(30000);
  });
  it("i canoni non entrano nei totali, né mensili né annuali", () => {
    const v = valutaAccettazione(righe, { righe: [U(1), U(2), U(5)], gruppi: { [G]: U(4) } });
    expect(totaliAccettazione(righe, v.decisioni, regole).accettati.imponibileCent).toBe(130000);
  });
  it("quantità e sconti sono rispettati", () => {
    const r = [
      riga(1, "una_tantum", 10000, { quantita: 3, scontoBp: 1000 }),
      riga(2, "una_tantum", 5000),
    ];
    const v = valutaAccettazione(r, { righe: [U(1)], gruppi: {} });
    expect(totaliAccettazione(r, v.decisioni, regole).accettati.imponibileCent).toBe(27000);
  });
  it("il bollo si ricalcola: sotto soglia dopo l'esclusione, senza IVA", () => {
    const forfettario = { ...regole, ivaAttiva: false, bolloAutomatico: true };
    const r = [riga(1, "una_tantum", 100000), riga(2, "una_tantum", 5000)];
    const tutta = valutaAccettazione(r, { righe: [U(1), U(2)], gruppi: {} });
    expect(totaliAccettazione(r, tutta.decisioni, forfettario).accettati.bolloCent).toBe(200);
    const piccola = valutaAccettazione(r, { righe: [U(2)], gruppi: {} });
    const t = totaliAccettazione(r, piccola.decisioni, forfettario);
    expect(t.originali.bolloCent).toBe(200);
    expect(t.accettati.bolloCent).toBe(0);
    expect(t.accettati.totaleCent).toBe(5000);
  });
  it("ritenuta e split payment seguono le sole righe accettate", () => {
    const pa = { ...regole, ritenutaBp: 2000, splitPayment: true };
    const v = valutaAccettazione(righe, { righe: [U(1)], gruppi: { [G]: null } });
    const t = totaliAccettazione(righe, v.decisioni, pa).accettati;
    expect(t.imponibileCent).toBe(100000);
    expect(t.ritenutaCent).toBe(20000);
    expect(t.ivaSplitCent).toBe(22000);
    expect(t.nettoDaPagareCent).toBe(100000 + 22000 - 20000 - 22000);
  });
});

describe("valoreRicorrenteAnnuo", () => {
  it("non somma le alternative: prima dell'accettazione conta la più economica", () => {
    // manutenzione: min(600, 60×12=720) = 600; hosting 50×12 = 600
    expect(valoreRicorrenteAnnuo(righe, false)).toBe(60000 + 60000);
  });
  it("dopo l'accettazione conta i soli canoni accettati", () => {
    const con = righe.map((r) => ({ ...r, accettata: r.id === U(4) || r.id === U(5) }));
    expect(valoreRicorrenteAnnuo(con, true)).toBe(6000 * 12 + 5000 * 12);
  });
});

describe("serviziRicorrenti", () => {
  it("un servizio per riga indipendente o gruppo, senza sommare le alternative", async () => {
    const { serviziRicorrenti } = await import("./accettazione");
    const conTesto = righe.map((r, i) => ({
      ...r,
      descrizione: [
        "Sito",
        "SEO",
        "Manutenzione — canone annuo",
        "Manutenzione — canone mensile",
        "Hosting",
      ][i] as string,
      accettata: null as boolean | null,
    }));
    const s = serviziRicorrenti(conTesto);
    expect(s.map((x) => x.nome)).toEqual(["Manutenzione", "Hosting"]);
    expect(s[0]?.alternative).toBe(true);
    expect(s[0]?.opzioni.map((o) => [o.tipo, o.importoCent])).toEqual([
      ["canone_annuo", 60000],
      ["canone_mensile", 6000],
    ]);
    expect(s[1]?.alternative).toBe(false);
  });
});
