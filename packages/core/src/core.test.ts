import { describe, expect, it } from "vitest";
import {
  aggiungiMesi,
  bozzaSollecito,
  calcolaTotali,
  formattaNumero,
  generaRate,
  giorniDiRitardo,
  importoRataDaCanoneAnnuo,
  moduliCompatibili,
  parseEuro,
  percentuale,
  prezzoVisualizzato,
  puoTransirePreventivo,
  type RegoleFiscali,
  roundDiv,
  serveSollecito,
  totaliConfiguratore,
  type VoceListino,
} from "./index";

const conIva: RegoleFiscali = {
  ivaAttiva: true,
  aliquotaIvaBp: 2200,
  bolloAutomatico: false,
  splitPayment: false,
};
const senzaIva: RegoleFiscali = {
  ivaAttiva: false,
  aliquotaIvaBp: 0,
  naturaSenzaIva: "N2.2",
  diciturSenzaIva: "Operazione non soggetta a IVA",
  bolloAutomatico: true,
  splitPayment: false,
};
const riga = (euro: number) => [{ quantita: 1, prezzoUnitarioCent: euro * 100 }];

describe("arrotondamenti", () => {
  it("arrotonda metà lontano da zero", () => {
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(-5, 2)).toBe(-3);
    expect(roundDiv(4, 3)).toBe(1);
    expect(roundDiv(-4, 3)).toBe(-1);
  });
  it("percentuale in punti base", () => {
    expect(percentuale(10000, 2200)).toBe(2200);
    expect(percentuale(999, 2200)).toBe(220); // 219,78 → 220
    expect(percentuale(1, 2200)).toBe(0);
  });
  it("parseEuro", () => {
    expect(parseEuro("12,50")).toBe(1250);
    expect(parseEuro("1.234,5")).toBe(123450);
    expect(parseEuro("€ 8")).toBe(800);
    expect(parseEuro("abc")).toBeNull();
  });
});

describe("IVA attiva", () => {
  it("22% su 1000", () => {
    const t = calcolaTotali(riga(1000), conIva);
    expect(t).toMatchObject({
      imponibileCent: 100000,
      ivaCent: 22000,
      totaleCent: 122000,
      bolloCent: 0,
    });
    expect(t.nettoDaPagareCent).toBe(122000);
  });
  it("aliquote diverse", () => {
    expect(calcolaTotali(riga(1000), { ...conIva, aliquotaIvaBp: 1000 }).ivaCent).toBe(10000);
    expect(calcolaTotali(riga(1000), { ...conIva, aliquotaIvaBp: 400 }).ivaCent).toBe(4000);
  });
  it("il bollo non si applica con IVA anche se automatico", () => {
    expect(calcolaTotali(riga(1000), { ...conIva, bolloAutomatico: true }).bolloCent).toBe(0);
  });
  it("sconto e quantità", () => {
    const t = calcolaTotali([{ quantita: 3, prezzoUnitarioCent: 10000, scontoBp: 1000 }], conIva);
    expect(t.imponibileCent).toBe(27000);
    expect(t.ivaCent).toBe(5940);
  });
  it("arrotonda l'IVA sul totale, non riga per riga", () => {
    const t = calcolaTotali(
      [
        { quantita: 1, prezzoUnitarioCent: 333 },
        { quantita: 1, prezzoUnitarioCent: 333 },
        { quantita: 1, prezzoUnitarioCent: 333 },
      ],
      conIva,
    );
    expect(t.imponibileCent).toBe(999);
    expect(t.ivaCent).toBe(220);
  });
});

describe("IVA disattiva e bollo", () => {
  it("bollo sopra 77,47", () => {
    const t = calcolaTotali(riga(1000), senzaIva);
    expect(t).toMatchObject({ ivaCent: 0, bolloCent: 200, totaleCent: 100200 });
  });
  it("nessun bollo a 77,47 esatti, sì a 77,48", () => {
    expect(calcolaTotali([{ quantita: 1, prezzoUnitarioCent: 7747 }], senzaIva).bolloCent).toBe(0);
    expect(calcolaTotali([{ quantita: 1, prezzoUnitarioCent: 7748 }], senzaIva).bolloCent).toBe(
      200,
    );
  });
  it("nessun bollo se non automatico", () => {
    expect(calcolaTotali(riga(1000), { ...senzaIva, bolloAutomatico: false }).bolloCent).toBe(0);
  });
});

describe("ritenuta e split payment", () => {
  it("ritenuta 20% sull'imponibile", () => {
    const t = calcolaTotali(riga(1000), { ...conIva, ritenutaBp: 2000 });
    expect(t.ritenutaCent).toBe(20000);
    expect(t.nettoDaPagareCent).toBe(102000);
  });
  it("split payment: l'IVA non è incassata dal fornitore", () => {
    const t = calcolaTotali(riga(1000), { ...conIva, splitPayment: true });
    expect(t.totaleCent).toBe(122000);
    expect(t.ivaSplitCent).toBe(22000);
    expect(t.nettoDaPagareCent).toBe(100000);
  });
  it("split e ritenuta insieme", () => {
    const t = calcolaTotali(riga(1000), { ...conIva, splitPayment: true, ritenutaBp: 2000 });
    expect(t.nettoDaPagareCent).toBe(80000);
  });
});

describe("prezzo visualizzato", () => {
  it("netto e lordo con IVA", () => {
    expect(prezzoVisualizzato(55000, conIva)).toEqual({
      nettoCent: 55000,
      lordoCent: 67100,
      ivaCent: 12100,
      dicitura: null,
    });
  });
  it("un solo prezzo con dicitura senza IVA", () => {
    const p = prezzoVisualizzato(55000, senzaIva);
    expect(p.lordoCent).toBeNull();
    expect(p.dicitura).toBe("Operazione non soggetta a IVA");
  });
});

describe("generazione rate", () => {
  const base = { inizio: "2026-01-15", importoCent: 4500, fino: "2026-12-31" };
  it("mensile: 12 rate", () => {
    const r = generaRate({ ...base, periodicita: "mensile" });
    expect(r).toHaveLength(12);
    expect(r[0]).toEqual({ scadenza: "2026-01-15", importoCent: 4500, numero: 1 });
    expect(r[11]?.scadenza).toBe("2026-12-15");
  });
  it("trimestrale: 4 rate", () => {
    expect(generaRate({ ...base, periodicita: "trimestrale" }).map((r) => r.scadenza)).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15",
    ]);
  });
  it("semestrale: 2 rate", () => {
    expect(generaRate({ ...base, periodicita: "semestrale" })).toHaveLength(2);
  });
  it("annuale: 1 rata, poi 3 su tre anni", () => {
    expect(generaRate({ ...base, periodicita: "annuale" })).toHaveLength(1);
    expect(generaRate({ ...base, periodicita: "annuale", fino: "2028-12-31" })).toHaveLength(3);
  });
  it("fine mese: mantiene il giorno di partenza quando possibile", () => {
    expect(aggiungiMesi("2026-01-31", 1)).toBe("2026-02-28");
    expect(aggiungiMesi("2026-01-31", 2)).toBe("2026-03-31");
    expect(aggiungiMesi("2028-01-31", 1)).toBe("2028-02-29");
    expect(aggiungiMesi("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("continua una serie con numeroIniziale", () => {
    const r = generaRate({ ...base, periodicita: "mensile", numeroIniziale: 13 });
    expect(r[0]?.numero).toBe(13);
  });
  it("importo rata da canone annuo", () => {
    expect(importoRataDaCanoneAnnuo(12000, "mensile")).toBe(1000);
    expect(importoRataDaCanoneAnnuo(12000, "trimestrale")).toBe(3000);
    expect(importoRataDaCanoneAnnuo(12000, "annuale")).toBe(12000);
  });
});

describe("numerazione", () => {
  it("formati", () => {
    expect(formattaNumero("P-{AAAA}-{NNN}", 7, 2026)).toBe("P-2026-007");
    expect(formattaNumero("MCD {N}/{AAAA}", 12, 2026)).toBe("MCD 12/2026");
    expect(formattaNumero("{AA}/{NNNN}", 3, 2026)).toBe("26/0003");
  });
});

describe("preventivo e configuratore", () => {
  it("transizioni", () => {
    expect(puoTransirePreventivo("bozza", "inviato")).toBe(true);
    expect(puoTransirePreventivo("bozza", "accettato")).toBe(false);
    expect(puoTransirePreventivo("accettato", "bozza")).toBe(false);
  });
  const voci: VoceListino[] = [
    {
      id: "sito",
      tipo: "base",
      nome: "Sito Web",
      unaTantumCent: 55000,
      canoneAnnuoCent: 2500,
      canoneMensileCent: 0,
    },
    {
      id: "cms",
      tipo: "base",
      nome: "CMS custom",
      unaTantumCent: 100000,
      canoneAnnuoCent: 45000,
      canoneMensileCent: 4500,
    },
    {
      id: "mccms",
      tipo: "modulo",
      nome: "MC CMS",
      unaTantumCent: 45000,
      canoneAnnuoCent: 25000,
      canoneMensileCent: 2500,
      baseIds: ["sito"],
    },
    {
      id: "domotica",
      tipo: "modulo",
      nome: "Domotica",
      unaTantumCent: 80000,
      canoneAnnuoCent: 35000,
      canoneMensileCent: 3500,
      baseIds: ["cms"],
    },
  ];
  it("solo moduli compatibili", () => {
    expect(moduliCompatibili("sito", voci).map((m) => m.id)).toEqual(["mccms"]);
    expect(moduliCompatibili("cms", voci).map((m) => m.id)).toEqual(["domotica"]);
  });
  it("totali", () => {
    const sito = voci[0];
    const mc = voci[2];
    if (!sito || !mc) throw new Error();
    expect(totaliConfiguratore([sito, mc])).toEqual({
      unaTantumCent: 100000,
      canoneAnnuoCent: 27500,
      canoneMensileCent: 2500,
    });
  });
});

describe("solleciti", () => {
  const base = {
    cliente: "Trattoria Da Marco",
    emittente: "Mattia Capelli",
    descrizioneRata: "Hosting — rata 3",
    importoCent: 6100,
    scadenza: "2026-10-15",
    oggi: "2026-10-27",
  };
  it("ritardo in giorni", () => {
    expect(giorniDiRitardo("2026-10-15", "2026-10-27")).toBe(12);
    expect(giorniDiRitardo("2026-10-27", "2026-10-15")).toBe(0);
  });
  it("tono crescente con il livello", () => {
    expect(bozzaSollecito({ ...base, livello: 1 }).oggetto).toMatch(/Promemoria/);
    expect(bozzaSollecito({ ...base, livello: 2 }).oggetto).toMatch(/Secondo/);
    expect(bozzaSollecito({ ...base, livello: 3 }).oggetto).toMatch(/Ultimo/);
    expect(bozzaSollecito({ ...base, livello: 9 }).oggetto).toMatch(/Ultimo/);
  });
  it("il corpo riporta importo, data e ritardo", () => {
    const { corpo } = bozzaSollecito({ ...base, livello: 1 });
    expect(corpo).toContain("61,00");
    expect(corpo).toContain("15/10/2026");
    expect(corpo).toContain("12 giorni");
    expect(corpo).toContain("Gentile Trattoria Da Marco");
  });
  it("quando serve un nuovo sollecito", () => {
    const oggi = "2026-10-27";
    expect(serveSollecito({ inviati: 0, daConfermare: 0, ultimoInvioIso: null, oggi })).toBe(true);
    expect(serveSollecito({ inviati: 0, daConfermare: 1, ultimoInvioIso: null, oggi })).toBe(false);
    expect(serveSollecito({ inviati: 3, daConfermare: 0, ultimoInvioIso: null, oggi })).toBe(false);
    expect(
      serveSollecito({ inviati: 1, daConfermare: 0, ultimoInvioIso: "2026-10-24T10:00:00Z", oggi }),
    ).toBe(false);
    expect(
      serveSollecito({ inviati: 1, daConfermare: 0, ultimoInvioIso: "2026-10-20T10:00:00Z", oggi }),
    ).toBe(true);
  });
});

describe("formatEuro", () => {
  it("mette il simbolo davanti e il segno meno prima", async () => {
    const { formatEuro, formatEuroCompatto } = await import("./money");
    expect(formatEuro(127500)).toBe("€ 1.275,00");
    expect(formatEuro(-20000)).toBe("− € 200,00");
    expect(formatEuroCompatto(722500)).toBe("€ 7.225");
    expect(formatEuroCompatto(722550)).toBe("€ 7.225,50");
  });
});
