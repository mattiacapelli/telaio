import { afterEach, describe, expect, it, vi } from "vitest";
import { creaTwentyClient, twentyDaEnv } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("client finto", () => {
  it("senza URL usa i dati finti e filtra per testo", async () => {
    const c = creaTwentyClient();
    expect(c.finto).toBe(true);
    expect((await c.elencaClienti({ testo: "comune" })).map((x) => x.nome)).toEqual([
      "Comune di Esempio",
    ]);
  });
});

describe("client reale", () => {
  it("mappa le Company di Twenty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            companies: [
              {
                id: "c1",
                name: "Acme",
                partitaIva: "123",
                pubblicaAmministrazione: true,
                address: { addressCity: "Bergamo" },
              },
            ],
          },
        }),
      ),
    );
    const c = creaTwentyClient({ apiUrl: "https://crm.test", apiKey: "k" });
    const [acme] = await c.elencaClienti();
    expect(acme).toMatchObject({
      id: "c1",
      nome: "Acme",
      partitaIva: "123",
      pa: true,
      citta: "Bergamo",
    });
  });
});

describe("twentyDaEnv", () => {
  it("in sviluppo senza Twenty usa i dati finti", async () => {
    const c = twentyDaEnv({ NODE_ENV: "development" });
    expect(c.finto).toBe(true);
    expect((await c.elencaClienti()).length).toBeGreaterThan(0);
  });

  it("in produzione senza Twenty non mostra mai clienti di esempio", async () => {
    const c = twentyDaEnv({ NODE_ENV: "production" });
    expect(c.finto).toBe(true);
    expect(await c.elencaClienti()).toEqual([]);
    expect(await c.dettaglioCliente("demo-1")).toBeNull();
    expect(await c.elencaOpportunita()).toEqual([]);
    expect(await c.elencaPersone("demo-1")).toEqual([]);
  });

  it("in produzione con Twenty configurato usa il client reale", () => {
    const c = twentyDaEnv({ NODE_ENV: "production", TWENTY_API_URL: "https://crm.example.com" });
    expect(c.finto).toBe(false);
  });
});
