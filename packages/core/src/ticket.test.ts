import { describe, expect, it } from "vitest";
import {
  codiceTicket,
  DISTANZA_MINIMA,
  PASSO_POSIZIONE,
  posizioneTra,
  ticketDatiSchema,
} from "./ticket";

describe("ticketDatiSchema", () => {
  it("richiede il titolo e mette i valori predefiniti", () => {
    expect(ticketDatiSchema.safeParse({ titolo: "  " }).success).toBe(false);
    const r = ticketDatiSchema.parse({ titolo: " Login rotto ", tipo: "", stato: "" });
    expect(r).toMatchObject({
      titolo: "Login rotto",
      tipo: "attivita",
      stato: "da_fare",
      priorita: "normale",
      descrizione: null,
      assegnatarioId: null,
      scadenza: null,
    });
  });

  it("rifiuta stati, tipi e scadenze non validi", () => {
    expect(ticketDatiSchema.safeParse({ titolo: "x", stato: "boh" }).success).toBe(false);
    expect(ticketDatiSchema.safeParse({ titolo: "x", tipo: "epic" }).success).toBe(false);
    expect(ticketDatiSchema.safeParse({ titolo: "x", scadenza: "31/12/2026" }).success).toBe(false);
    expect(ticketDatiSchema.safeParse({ titolo: "x", scadenza: "2026-12-31" }).success).toBe(true);
  });
});

describe("codiceTicket", () => {
  it("unisce codice del progetto e numero", () => {
    expect(codiceTicket("PRJ-2026-001", 7)).toBe("PRJ-2026-001-7");
  });
});

describe("posizioneTra", () => {
  it("colonna vuota, in cima, in fondo e in mezzo", () => {
    expect(posizioneTra(null, null)).toBe(PASSO_POSIZIONE);
    expect(posizioneTra(null, 1000)).toBe(0);
    expect(posizioneTra(2000, null)).toBe(3000);
    expect(posizioneTra(1000, 2000)).toBe(1500);
  });

  it("senza spazio tra i vicini chiede di riordinare", () => {
    expect(posizioneTra(1, 1 + DISTANZA_MINIMA)).toBeNull();
    expect(posizioneTra(1, 1)).toBeNull();
  });
});
