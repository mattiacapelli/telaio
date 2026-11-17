import { describe, expect, it } from "vitest";
import {
  arrotondaMinuti,
  cicloDi,
  formattaOre,
  inizioCiclo,
  leggiDurata,
  monteOreDatiSchema,
  saldoCiclo,
  storicoMonteOre,
} from "./ore";

describe("arrotondaMinuti", () => {
  it("per eccesso al passo; zero resta zero", () => {
    expect(arrotondaMinuti(1, 15)).toBe(15);
    expect(arrotondaMinuti(15, 15)).toBe(15);
    expect(arrotondaMinuti(16, 15)).toBe(30);
    expect(arrotondaMinuti(50, 30)).toBe(60);
    expect(arrotondaMinuti(7, 1)).toBe(7);
    expect(arrotondaMinuti(0, 15)).toBe(0);
  });
});

describe("formattaOre", () => {
  it("ore e minuti, anche negativi", () => {
    expect(formattaOre(450)).toBe("7 h 30 min");
    expect(formattaOre(45)).toBe("45 min");
    expect(formattaOre(120)).toBe("2 h");
    expect(formattaOre(0)).toBe("0 min");
    expect(formattaOre(-90)).toBe("−1 h 30 min");
  });
});

describe("leggiDurata", () => {
  it("capisce i formati comuni; un numero nudo sono ore", () => {
    expect(leggiDurata("1:30")).toBe(90);
    expect(leggiDurata("0:45")).toBe(45);
    expect(leggiDurata("1h30")).toBe(90);
    expect(leggiDurata("1h 30m")).toBe(90);
    expect(leggiDurata("2h")).toBe(120);
    expect(leggiDurata("90m")).toBe(90);
    expect(leggiDurata("45min")).toBe(45);
    expect(leggiDurata("2")).toBe(120);
    expect(leggiDurata("1,5")).toBe(90);
    expect(leggiDurata("0.25")).toBe(15);
    for (const x of ["", "abc", "1:75", "-1", "1h99x"]) expect(leggiDurata(x), x).toBeNull();
  });
});

describe("cicli dal giorno di inizio", () => {
  it("il periodo va dal giorno di inizio al giorno prima del mese dopo", () => {
    expect(cicloDi("2026-01-15", "2026-01-15")).toEqual({
      n: 0,
      inizio: "2026-01-15",
      fine: "2026-02-14",
    });
    expect(cicloDi("2026-01-15", "2026-02-14")?.n).toBe(0);
    expect(cicloDi("2026-01-15", "2026-02-15")).toEqual({
      n: 1,
      inizio: "2026-02-15",
      fine: "2026-03-14",
    });
    expect(cicloDi("2026-01-15", "2026-01-14")).toBeNull();
    expect(cicloDi("2026-01-15", "2027-01-20")?.n).toBe(12);
  });
  it("il giorno 31 si adatta ai mesi corti senza scivolare", () => {
    expect(inizioCiclo("2026-01-31", 1)).toBe("2026-02-28");
    expect(inizioCiclo("2026-01-31", 2)).toBe("2026-03-31");
    expect(cicloDi("2026-01-31", "2026-03-01")).toEqual({
      n: 1,
      inizio: "2026-02-28",
      fine: "2026-03-30",
    });
    expect(cicloDi("2026-01-31", "2026-03-31")?.n).toBe(2);
  });
  it("il mese solare è il caso del giorno 1", () => {
    expect(cicloDi("2026-01-01", "2026-12-31")).toEqual({
      n: 11,
      inizio: "2026-12-01",
      fine: "2026-12-31",
    });
  });
});

describe("saldo", () => {
  it("rimanenti, extra e percentuale", () => {
    const c = { n: 0, inizio: "2026-01-01", fine: "2026-01-31" };
    expect(saldoCiclo(c, 600, 450)).toMatchObject({ rimanenti: 150, extra: 0, percentuale: 75 });
    expect(saldoCiclo(c, 600, 690)).toMatchObject({ rimanenti: -90, extra: 90, percentuale: 115 });
  });

  it("le ore non usate decadono: ogni periodo parte da zero", () => {
    const contratto = { dataInizio: "2026-01-15", dataFine: null, minutiIncluse: 600 };
    const voci = [
      { data: "2026-01-20", minuti: 300 },
      { data: "2026-02-10", minuti: 300 }, // ancora periodo 0
      { data: "2026-02-20", minuti: 120 }, // periodo 1
    ];
    const { corrente, cicli } = storicoMonteOre(contratto, voci, "2026-02-25");
    expect(cicli.map((c) => [c.n, c.usati, c.rimanenti])).toEqual([
      [0, 600, 0],
      [1, 120, 480],
    ]);
    expect(corrente?.n).toBe(1);
  });

  it("prima dell'inizio non c'è un periodo; dopo la fine resta l'ultimo", () => {
    const c = { dataInizio: "2026-03-01", dataFine: "2026-04-15", minutiIncluse: 60 };
    expect(storicoMonteOre(c, [], "2026-02-01")).toEqual({ corrente: null, cicli: [] });
    const dopo = storicoMonteOre(c, [], "2026-09-01");
    expect(dopo.corrente?.n).toBe(1);
    expect(dopo.corrente?.fine).toBe("2026-04-15"); // tagliato alla fine del contratto
  });
});

describe("monteOreDatiSchema", () => {
  const base = { nome: " Assistenza ", minutiIncluse: "600", dataInizio: "2026-01-15" };
  it("valori predefiniti e conversioni dal form", () => {
    expect(monteOreDatiSchema.parse(base)).toMatchObject({
      nome: "Assistenza",
      minutiIncluse: 600,
      arrotondamentoMinuti: 15,
      tariffaOrariaCent: 0,
      dataFine: null,
    });
    expect(
      monteOreDatiSchema.parse({ ...base, dataFine: "", arrotondamentoMinuti: "30" }),
    ).toMatchObject({
      arrotondamentoMinuti: 30,
      dataFine: null,
    });
  });
  it("rifiuta passo, date e ore non valide", () => {
    for (const x of [
      { arrotondamentoMinuti: 7 },
      { dataInizio: "2026-02-31" },
      { dataFine: "2025-12-31" },
      { minutiIncluse: 0 },
      { nome: " " },
    ])
      expect(monteOreDatiSchema.safeParse({ ...base, ...x }).success, JSON.stringify(x)).toBe(
        false,
      );
  });
});
