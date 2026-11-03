import { describe, expect, it } from "vitest";
import {
  dateEffettiveDaStato,
  progettoDatiSchema,
  risorsaSchema,
  urlRisorsaValido,
} from "./progetti";

describe("progettoDatiSchema", () => {
  it("applica i valori predefiniti e normalizza i campi vuoti", () => {
    const r = progettoDatiSchema.parse({
      nome: "  Sito Rossi ",
      descrizione: "",
      categoria: "",
      responsabileId: "",
      dataInizioPrevista: "",
    });
    expect(r).toMatchObject({
      nome: "Sito Rossi",
      descrizione: null,
      categoria: "altro",
      stato: "pianificato",
      priorita: "normale",
      responsabileId: null,
      dataInizioPrevista: null,
    });
  });
  it("rifiuta nome vuoto, categoria sconosciuta e date incoerenti", () => {
    expect(progettoDatiSchema.safeParse({ nome: "  " }).success).toBe(false);
    expect(progettoDatiSchema.safeParse({ nome: "x", categoria: "magia" }).success).toBe(false);
    expect(progettoDatiSchema.safeParse({ nome: "x", stato: "chiuso" }).success).toBe(false);
    const date = progettoDatiSchema.safeParse({
      nome: "x",
      dataInizioPrevista: "2026-05-10",
      dataFinePrevista: "2026-05-01",
    });
    expect(date.success).toBe(false);
    expect(
      progettoDatiSchema.safeParse({ nome: "x", dataInizioPrevista: "10/05/2026" }).success,
    ).toBe(false);
  });
});

describe("urlRisorsaValido e risorsaSchema", () => {
  it("accetta solo http e https", () => {
    expect(urlRisorsaValido("https://github.com/org/repo")).toBe(true);
    expect(urlRisorsaValido("http://localhost:3000/x?y=1")).toBe(true);
    for (const u of [
      "ftp://x.it",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,x",
      "github.com/x",
      "",
    ])
      expect(urlRisorsaValido(u), u).toBe(false);
  });
  it("rifiuta le credenziali incorporate nell'indirizzo", () => {
    expect(urlRisorsaValido("https://utente:segreto@host.it/")).toBe(false);
    expect(urlRisorsaValido("https://token@host.it/")).toBe(false);
  });
  it("valida la risorsa e normalizza ambiente e principale", () => {
    const r = risorsaSchema.parse({
      tipo: "staging",
      titolo: " Staging ",
      url: " https://staging.example.com ",
      descrizione: "",
      ambiente: "",
      principale: "on",
    });
    expect(r).toMatchObject({
      titolo: "Staging",
      url: "https://staging.example.com",
      descrizione: null,
      ambiente: null,
      principale: true,
    });
    expect(
      risorsaSchema.parse({ tipo: "other", titolo: "a", url: "https://a.it" }).principale,
    ).toBe(false);
    expect(risorsaSchema.safeParse({ tipo: "boh", titolo: "a", url: "https://a.it" }).success).toBe(
      false,
    );
    expect(
      risorsaSchema.safeParse({ tipo: "other", titolo: "a", url: "javascript:x" }).success,
    ).toBe(false);
    expect(
      risorsaSchema.safeParse({ tipo: "other", titolo: "", url: "https://a.it" }).success,
    ).toBe(false);
    expect(
      risorsaSchema.safeParse({ tipo: "other", titolo: "a", url: "https://a.it", ambiente: "test" })
        .success,
    ).toBe(false);
  });
});

describe("dateEffettiveDaStato", () => {
  const vuote = { dataInizioEffettiva: null, dataFineEffettiva: null };
  it("fissa l'inizio al primo passaggio in corso e non lo sovrascrive", () => {
    const a = dateEffettiveDaStato("in_corso", vuote, "2026-11-03");
    expect(a).toEqual({ dataInizioEffettiva: "2026-11-03", dataFineEffettiva: null });
    expect(dateEffettiveDaStato("in_corso", a, "2026-12-01").dataInizioEffettiva).toBe(
      "2026-11-03",
    );
  });
  it("completato fissa la fine (e l'inizio se mancava); riaprire cancella la fine", () => {
    const c = dateEffettiveDaStato("completato", vuote, "2026-11-03");
    expect(c).toEqual({ dataInizioEffettiva: "2026-11-03", dataFineEffettiva: "2026-11-03" });
    expect(dateEffettiveDaStato("in_corso", c, "2026-11-10")).toEqual({
      dataInizioEffettiva: "2026-11-03",
      dataFineEffettiva: null,
    });
  });
  it("pianificato, in attesa e annullato non toccano l'inizio", () => {
    for (const s of ["pianificato", "in_attesa", "annullato"] as const)
      expect(dateEffettiveDaStato(s, vuote, "2026-11-03")).toEqual(vuote);
  });
});
