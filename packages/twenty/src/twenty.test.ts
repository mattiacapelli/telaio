import { afterEach, describe, expect, it, vi } from "vitest";
import { creaTwentyClient } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("client finto", () => {
  it("senza URL usa i dati finti e filtra per testo", async () => {
    const c = creaTwentyClient();
    expect(c.finto).toBe(true);
    expect((await c.elencaClienti({ testo: "comune" })).map((x) => x.nome)).toEqual(["Comune di Esempio"]);
  });
});

describe("client reale", () => {
  it("mappa le Company di Twenty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: { companies: [{ id: "c1", name: "Acme", partitaIva: "123", pubblicaAmministrazione: true, address: { addressCity: "Bergamo" } }] },
        }),
      ),
    );
    const c = creaTwentyClient({ apiUrl: "https://crm.test", apiKey: "k" });
    const [acme] = await c.elencaClienti();
    expect(acme).toMatchObject({ id: "c1", nome: "Acme", partitaIva: "123", pa: true, citta: "Bergamo" });
  });
});
