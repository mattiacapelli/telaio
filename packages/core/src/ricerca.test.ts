import { describe, expect, it } from "vitest";
import { normalizzaTesto, punteggioRicerca } from "./ricerca";

describe("normalizzaTesto", () => {
  it("toglie accenti e maiuscole e comprime gli spazi", () => {
    expect(normalizzaTesto("  Perché  È  Così ")).toBe("perche e cosi");
  });
});

describe("punteggioRicerca", () => {
  const incasso = { titolo: "Registra incasso", sottotitolo: "Bonifico, contante o carta" };

  it("0 se una parola non compare", () => {
    expect(punteggioRicerca("incasso zebra", incasso)).toBe(0);
    expect(punteggioRicerca("", incasso)).toBe(0);
  });

  it("l'inizio del titolo vale più di un pezzo di parola e del sottotitolo", () => {
    const iniz = punteggioRicerca("regi", incasso);
    const parola = punteggioRicerca("inc", incasso);
    const sub = punteggioRicerca("bonif", incasso);
    expect(iniz).toBeGreaterThan(parola);
    expect(parola).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(0);
  });

  it("ignora accenti e ordine delle parole", () => {
    expect(punteggioRicerca("INCASSO registra", incasso)).toBeGreaterThan(0);
    expect(
      punteggioRicerca("liquidita", { titolo: "Cash flow", parole: ["liquidità"] }),
    ).toBeGreaterThan(0);
  });

  it("singolare e plurale si trovano a vicenda", () => {
    expect(punteggioRicerca("incasso", { titolo: "Incassi" })).toBeGreaterThan(0);
    expect(punteggioRicerca("fatture", { titolo: "Fattura" })).toBeGreaterThan(0);
    expect(punteggioRicerca("incassa", { titolo: "Scadenzario" })).toBe(0);
  });

  it("trova per sinonimo", () => {
    expect(
      punteggioRicerca("smtp", { titolo: "Email e mittenti", parole: ["smtp"] }),
    ).toBeGreaterThan(0);
  });
});
