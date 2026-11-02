import { describe, expect, it } from "vitest";
import {
  conFirma,
  EMAIL_PREDEFINITE,
  emailImpostazioniSchema,
  indirizzoConNome,
  mittenteSchema,
  risolviMittente,
} from "./email";

describe("mittente", () => {
  it("accetta campi vuoti e normalizza gli spazi", () => {
    expect(mittenteSchema.parse({})).toEqual({ nome: "", email: "", rispondiA: "" });
    expect(mittenteSchema.parse({ nome: "  Studio Rossi ", email: " info@rossi.it " })).toEqual({
      nome: "Studio Rossi",
      email: "info@rossi.it",
      rispondiA: "",
    });
  });
  it("rifiuta indirizzi non validi o con ritorni a capo", () => {
    expect(mittenteSchema.safeParse({ email: "non-una-email" }).success).toBe(false);
    expect(mittenteSchema.safeParse({ rispondiA: "a@b.it\r\nBcc: x@y.it" }).success).toBe(false);
    expect(mittenteSchema.safeParse({ nome: "x".repeat(81) }).success).toBe(false);
  });
  it("le impostazioni hanno valori predefiniti", () => {
    expect(emailImpostazioniSchema.parse({})).toEqual(EMAIL_PREDEFINITE);
    expect(emailImpostazioniSchema.safeParse({ firma: "x".repeat(501) }).success).toBe(false);
  });
});

describe("da chi parte l'email", () => {
  const rs = { nome: "MC Digital S.r.l.", email: "amministrazione@mcdigital.it" };
  it("usa il mittente impostato, con il nome della ragione sociale se manca", () => {
    const m = mittenteSchema.parse({
      email: "fatture@mcdigital.it",
      rispondiA: "info@mcdigital.it",
    });
    expect(risolviMittente({ mittente: m, ragioneSociale: rs })).toEqual({
      from: '"MC Digital S.r.l." <fatture@mcdigital.it>',
      replyTo: "info@mcdigital.it",
    });
    const n = mittenteSchema.parse({ nome: "Mattia", email: "m@mcdigital.it" });
    expect(risolviMittente({ mittente: n, ragioneSociale: rs }).from).toBe(
      '"Mattia" <m@mcdigital.it>',
    );
  });
  it("senza mittente usa l'email della ragione sociale, come prima", () => {
    expect(risolviMittente({ ragioneSociale: rs }).from).toBe(
      '"MC Digital S.r.l." <amministrazione@mcdigital.it>',
    );
  });
  it("senza nulla lascia decidere al mittente di sistema (SMTP_FROM)", () => {
    expect(risolviMittente({})).toEqual({});
    expect(risolviMittente({ ragioneSociale: { nome: "X", email: null } })).toEqual({});
  });
  it("il nome non può rompere l'intestazione", () => {
    expect(indirizzoConNome('Mario "Il Boss" <x@y.it>\r\nBcc: z', "a@b.it")).toBe(
      '"Mario Il Boss x@y.it Bcc: z" <a@b.it>',
    );
  });
});

describe("firma", () => {
  it("si aggiunge dopo una riga vuota e il separatore", () => {
    expect(conFirma("Gentile cliente,\nsaluti.\n", "Mattia\nMC Digital")).toBe(
      "Gentile cliente,\nsaluti.\n\n-- \nMattia\nMC Digital",
    );
  });
  it("senza firma il testo resta com'è", () => {
    expect(conFirma("ciao", "  ")).toBe("ciao");
  });
});
