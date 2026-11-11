import { describe, expect, it } from "vitest";
import {
  archivioConfigSchema,
  chiaveOggetto,
  formattaDimensione,
  linkDatiSchema,
  nomeFileSicuro,
  normalizzaPrefisso,
} from "./archivio";

describe("archivioConfigSchema", () => {
  const base = { bucket: "telaio-documenti" };

  it("valori predefiniti: AWS, regione us-east-1, nessun prefisso", () => {
    expect(archivioConfigSchema.parse(base)).toEqual({
      endpoint: "",
      region: "us-east-1",
      bucket: "telaio-documenti",
      prefisso: "",
      pathStyle: false,
    });
  });

  it("accetta un endpoint http/https e toglie la barra finale", () => {
    expect(
      archivioConfigSchema.parse({ ...base, endpoint: "http://localhost:9100/" }).endpoint,
    ).toBe("http://localhost:9100");
  });

  it("rifiuta endpoint con credenziali o protocolli strani", () => {
    for (const endpoint of ["ftp://x.it", "https://utente:pw@x.it", "x.it", "javascript:alert(1)"])
      expect(archivioConfigSchema.safeParse({ ...base, endpoint }).success, endpoint).toBe(false);
  });

  it("rifiuta nomi di bucket non validi", () => {
    for (const bucket of ["", "ab", "Maiuscole", "con spazi", "-inizio", "fine-", "a".repeat(64)])
      expect(archivioConfigSchema.safeParse({ bucket }).success, bucket).toBe(false);
  });
});

describe("normalizzaPrefisso", () => {
  it("niente barra iniziale né percorsi relativi, una barra finale", () => {
    expect(normalizzaPrefisso("")).toBe("");
    expect(normalizzaPrefisso("/telaio//docs/")).toBe("telaio/docs/");
    expect(normalizzaPrefisso("../../etc/./x")).toBe("etc/x/");
  });
});

describe("nomeFileSicuro", () => {
  it("toglie percorsi e caratteri pericolosi", () => {
    expect(nomeFileSicuro("../../etc/passwd")).toBe("passwd");
    expect(nomeFileSicuro("C:\\Users\\mario\\contratto.pdf")).toBe("contratto.pdf");
    expect(nomeFileSicuro('a"b<c>d|e?.txt')).toBe("abcde.txt");
    expect(nomeFileSicuro(".hidden")).toBe("hidden");
    expect(nomeFileSicuro("   ")).toBe("file");
    expect(nomeFileSicuro("riga\ninterrotta.pdf")).toBe("rigainterrotta.pdf");
  });

  it("accorcia i nomi lunghi conservando l'estensione", () => {
    const n = nomeFileSicuro(`${"a".repeat(300)}.pdf`);
    expect(n.length).toBeLessThanOrEqual(150);
    expect(n.endsWith(".pdf")).toBe(true);
  });
});

describe("chiaveOggetto", () => {
  it("prefisso, progetto, documento e nome innocuo", () => {
    expect(
      chiaveOggetto({
        prefisso: "/telaio",
        cartella: "progetti",
        proprietarioId: "p1",
        documentoId: "d1",
        nome: "../a b.pdf",
      }),
    ).toBe("telaio/progetti/p1/d1/a b.pdf");
    expect(
      chiaveOggetto({
        prefisso: "",
        cartella: "preventivi",
        proprietarioId: "q1",
        documentoId: "d1",
        nome: "x.txt",
      }),
    ).toBe("preventivi/q1/d1/x.txt");
  });
});

describe("linkDatiSchema", () => {
  it("accetta solo indirizzi http(s) senza credenziali", () => {
    const ok = linkDatiSchema.parse({ titolo: " Figma ", url: " https://figma.com/file/1 " });
    expect(ok).toEqual({ titolo: "Figma", url: "https://figma.com/file/1" });
    for (const url of ["javascript:alert(1)", "ftp://x.it", "https://u:p@x.it", "non un url", ""])
      expect(linkDatiSchema.safeParse({ titolo: "x", url }).success).toBe(false);
    expect(linkDatiSchema.safeParse({ titolo: " ", url: "https://x.it" }).success).toBe(false);
  });
});

describe("formattaDimensione", () => {
  it("scala l'unità", () => {
    expect(formattaDimensione(12)).toBe("12 B");
    expect(formattaDimensione(2048)).toBe("2 KB");
    expect(formattaDimensione(1536 * 1024)).toBe("1,5 MB");
  });
});
