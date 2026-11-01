import { describe, expect, it } from "vitest";
import {
  adminSchema,
  aziendaSchema,
  erroriPerCampo,
  logoValido,
  partitaIvaItalianaValida,
  preferenzeSchema,
  sicurezzaSchema,
} from "./setup";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const azienda = {
  nome: "Studio Rossi",
  tipo: "srl",
  partitaIva: "01234567897",
  paese: "IT",
  fusoOrario: "Europe/Rome",
  valuta: "EUR",
  lingua: "it",
  logo: null,
};

describe("partita IVA italiana", () => {
  it("accetta una partita IVA con cifra di controllo corretta", () => {
    expect(partitaIvaItalianaValida("01234567897")).toBe(true);
  });
  it("rifiuta cifra di controllo errata, lunghezza e caratteri non numerici", () => {
    expect(partitaIvaItalianaValida("01234567890")).toBe(false);
    expect(partitaIvaItalianaValida("1234567890")).toBe(false);
    expect(partitaIvaItalianaValida("0123456789A")).toBe(false);
    expect(partitaIvaItalianaValida("")).toBe(false);
  });
});

describe("logo", () => {
  it("accetta un PNG reale", () => expect(logoValido(PNG)).toBe(true));
  it("rifiuta tipi non ammessi (SVG, GIF) e dati che non sono immagini", () => {
    expect(logoValido("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
    expect(logoValido("data:image/gif;base64,R0lGODlhAQABAAAAACw=")).toBe(false);
    expect(logoValido("data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false); // non è un PNG
    expect(logoValido("https://esempio.it/logo.png")).toBe(false);
    expect(logoValido("")).toBe(false);
  });
  it("rifiuta immagini oltre i 200 KB", () => {
    const grande = `data:image/png;base64,iVBORw0KGgo${"A".repeat(300_000)}`;
    expect(logoValido(grande)).toBe(false);
  });
});

describe("azienda", () => {
  it("accetta i dati minimi e normalizza la partita IVA e i campi vuoti", () => {
    const r = aziendaSchema.parse({ ...azienda, partitaIva: " 012 345 678 97 ", logo: "" });
    expect(r.partitaIva).toBe("01234567897");
    expect(r.logo).toBeNull();
    expect(aziendaSchema.parse({ ...azienda, partitaIva: "" }).partitaIva).toBeNull();
  });
  it("segnala i campi errati", () => {
    const r = aziendaSchema.safeParse({
      ...azienda,
      nome: " ",
      partitaIva: "12345678901",
      paese: "XX",
      valuta: "BTC",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = erroriPerCampo(r.error);
      expect(Object.keys(e).sort()).toEqual(["nome", "paese", "valuta"]);
    }
    expect(aziendaSchema.safeParse({ ...azienda, partitaIva: "12345678901" }).success).toBe(false);
  });
  it("fuori dall'Italia la partita IVA non segue la regola italiana", () => {
    expect(
      aziendaSchema.safeParse({ ...azienda, paese: "DE", partitaIva: "DE123456789" }).success,
    ).toBe(true);
    expect(aziendaSchema.safeParse({ ...azienda, paese: "DE", partitaIva: "!!" }).success).toBe(
      false,
    );
  });
});

describe("amministratore", () => {
  const ok = {
    nome: "Mario",
    cognome: "Rossi",
    email: "  Mario@Example.COM ",
    password: "una-password-lunga-1",
    conferma: "una-password-lunga-1",
  };
  it("normalizza l'email", () => {
    expect(adminSchema().parse(ok).email).toBe("mario@example.com");
  });
  it("rifiuta password corte, diverse dalla conferma o uguali all'email", () => {
    const corta = adminSchema().safeParse({ ...ok, password: "corta", conferma: "corta" });
    expect(corta.success).toBe(false);
    const diversa = adminSchema().safeParse({ ...ok, conferma: "altra-password-lunga" });
    expect(diversa.success && "no").toBe(false);
    if (!diversa.success) expect(erroriPerCampo(diversa.error).conferma).toMatch(/coincidono/);
    const uguale = adminSchema().safeParse({
      ...ok,
      email: "mario.rossi.lungo@example.com",
      password: "mario.rossi.lungo@example.com",
      conferma: "mario.rossi.lungo@example.com",
    });
    expect(uguale.success).toBe(false);
  });
  it("non scende mai sotto il minimo di base, anche se la politica è più bassa", () => {
    expect(
      adminSchema(8).safeParse({ ...ok, password: "dodici-1234", conferma: "dodici-1234" }).success,
    ).toBe(false);
  });
  it("applica la lunghezza minima scelta", () => {
    const p = "una-password-lunga-1"; // 20 caratteri
    expect(adminSchema(16).safeParse({ ...ok, password: p, conferma: p }).success).toBe(true);
    expect(
      adminSchema(16).safeParse({ ...ok, password: "x".repeat(15), conferma: "x".repeat(15) })
        .success,
    ).toBe(false);
  });
  it("rifiuta password enormi e email o nomi non validi", () => {
    const enorme = "a".repeat(129);
    expect(adminSchema().safeParse({ ...ok, password: enorme, conferma: enorme }).success).toBe(
      false,
    );
    expect(adminSchema().safeParse({ ...ok, email: "non-una-email" }).success).toBe(false);
    expect(adminSchema().safeParse({ ...ok, nome: "" }).success).toBe(false);
  });
});

describe("sicurezza e preferenze", () => {
  it("la lunghezza minima è una di quelle previste", () => {
    expect(sicurezzaSchema.safeParse({ passwordMinima: 14, guidaSicurezza: true }).success).toBe(
      true,
    );
    expect(sicurezzaSchema.safeParse({ passwordMinima: 6, guidaSicurezza: true }).success).toBe(
      false,
    );
  });
  const pref = {
    ivaAttiva: true,
    aliquotaIva: 22,
    formatoPreventivo: "P-{AAAA}-{NNN}",
    formatoFattura: "F-{AAAA}-{NNN}",
  };
  it("accetta preferenze valide", () =>
    expect(preferenzeSchema.safeParse(pref).success).toBe(true));
  it("richiede il numero progressivo nei formati", () => {
    const r = preferenzeSchema.safeParse({ ...pref, formatoFattura: "FATTURA" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(erroriPerCampo(r.error))).toEqual(["formatoFattura"]);
  });
  it("controlla l'aliquota", () => {
    expect(preferenzeSchema.safeParse({ ...pref, aliquotaIva: -1 }).success).toBe(false);
    expect(preferenzeSchema.safeParse({ ...pref, aliquotaIva: 101 }).success).toBe(false);
    expect(preferenzeSchema.safeParse({ ...pref, aliquotaIva: 22.555 }).success).toBe(false);
    expect(preferenzeSchema.safeParse({ ...pref, aliquotaIva: 22.5 }).success).toBe(true);
  });
});
