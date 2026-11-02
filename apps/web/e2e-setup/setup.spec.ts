import { createRequire } from "node:module";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

// Postgres per controllare il database direttamente (il pacchetto sta in packages/db).
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.E2E_DATABASE_URL as string, { max: 3, onnotice: () => {} });

const CODICE = "codice-di-prova-0123456789";
const PASSWORD = "una-password-molto-lunga-42";
const EMAIL = "mario.rossi@example.com";
const SEGRETI_DA_NON_VEDERE = [
  CODICE,
  PASSWORD,
  process.env.BETTER_AUTH_SECRET ?? "segreto-non-impostato-xyz",
  process.env.E2E_DATABASE_URL ?? "db-non-impostato-xyz",
];

/** Tutto ciò che il browser riceve (pagine e risposte delle azioni) viene controllato alla fine. */
const ricevuto: string[] = [];
/** Richieste delle Server Actions viste dal browser, per riprovarle dopo il completamento. */
const azioniViste: { id: string; contentType: string; body: string }[] = [];
function osserva(page: Page) {
  page.on("request", (r) => {
    const id = r.headers()["next-action"];
    if (r.method() === "POST" && id)
      azioniViste.push({
        id,
        contentType: r.headers()["content-type"] ?? "",
        body: r.postData() ?? "",
      });
  });
  page.on("response", async (r) => {
    const tipo = r.headers()["content-type"] ?? "";
    if (/text|json|javascript/.test(tipo) && !r.url().includes("/_next/static")) {
      try {
        ricevuto.push(await r.text());
      } catch {}
    }
  });
}

async function conta(tabella: string) {
  const [r] = await sql.unsafe(`select count(*)::int as n from ${tabella}`);
  return r.n as number;
}

async function accedi(page: Page) {
  await page.goto("/setup");
  if (await page.getByLabel("Codice di setup").isVisible()) {
    await page.getByLabel("Codice di setup").fill(CODICE);
    await page.getByRole("button", { name: "Continua" }).click();
  }
  await expect(page.getByRole("heading", { name: /Passo|Configura Telaio/ }).first()).toBeVisible();
}

async function nuovoContesto(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const page = await ctx.newPage();
  osserva(page);
  return { ctx, page };
}

async function avanti(page: Page, nome = "Continua") {
  await page.getByRole("button", { name: nome, exact: true }).click();
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});

test.describe("prima configurazione", () => {
  let page: Page;
  let ctx: BrowserContext;
  let hashAccount = "";

  test.beforeAll(async ({ browser }) => {
    ({ ctx, page } = await nuovoContesto(browser));
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test("database appena inizializzato: vuoto, senza dati demo, senza utenti", async () => {
    expect(await conta("users")).toBe(0);
    expect(await conta("ragioni_sociali")).toBe(0);
    expect(await conta("conti")).toBe(0);
    expect(await conta("listini")).toBe(0);
    expect(await conta("impostazioni")).toBe(0);
  });

  test("ogni pagina applicativa rimanda a /setup, senza loop", async () => {
    for (const percorso of ["/", "/clienti", "/preventivi", "/impostazioni/sicurezza", "/login"]) {
      await page.goto(percorso);
      await expect(page, `da ${percorso}`).toHaveURL(/\/setup$/);
    }
  });

  test("restano raggiungibili solo le route necessarie", async ({ request }) => {
    expect((await request.get("/api/health")).status()).toBe(200);
    expect((await request.get("/manifest.webmanifest")).status()).toBe(200);
    expect((await request.get("/icons/icon-192.png")).status()).toBe(200);
    const protetta = await request.get("/clienti", { maxRedirects: 0 });
    expect(protetta.status()).toBe(307);
    expect(protetta.headers().location).toContain("/setup");
  });

  test("senza il codice di setup il wizard non si apre", async () => {
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Codice di setup" })).toBeVisible();
    await expect(page.getByLabel("Nome dell'azienda")).toHaveCount(0);
    await page.getByLabel("Codice di setup").fill("codice-sbagliato-0000000");
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(page.getByText("Codice non corretto.")).toBeVisible();
    await expect(page.getByLabel("Nome dell'azienda")).toHaveCount(0);
    // il cookie di accesso è httpOnly: non lo legge nessuno script
    await page.getByLabel("Codice di setup").fill(CODICE);
    await page.getByRole("button", { name: "Continua" }).click();
    await expect(page.getByRole("heading", { name: "Configura Telaio" })).toBeVisible();
    const cookie = (await ctx.cookies()).find((c) => c.name === "telaio-setup");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain("telaio-setup");
  });

  test("passo 1: verifica del sistema", async () => {
    await expect(page.getByText("Database PostgreSQL raggiungibile")).toBeVisible();
    await expect(page.getByText("Migrazioni applicate")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await avanti(page, "Inizia");
    await expect(page.getByRole("heading", { name: "Azienda", level: 2 })).toBeVisible();
  });

  test("passo 2: la validazione segnala i campi e non salva", async () => {
    await avanti(page);
    await expect(page.getByText("Inserisci il nome dell'azienda")).toBeVisible();
    await page.getByLabel("Nome dell'azienda").fill("Studio Rossi");
    await page.getByLabel("Partita IVA (facoltativa)").fill("12345678901");
    await avanti(page);
    await expect(page.getByText("Partita IVA non valida (11 cifre)")).toBeVisible();
    expect(await conta("impostazioni")).toBe(1); // solo la bozza con "passo 2"
  });

  test("passo 2: salva l'azienda, con un logo", async () => {
    await page.getByLabel("Partita IVA (facoltativa)").fill("01234567897");
    await page.getByLabel("Tipo").selectOption("srl");
    await page.setInputFiles('input[name="logo"]', {
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(page.getByAltText("Anteprima del logo")).toBeVisible();
    await avanti(page);
    await expect(page.getByRole("heading", { name: "Amministratore", level: 2 })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  test("refresh durante il wizard: riprende dallo stesso passo con i dati salvati", async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Amministratore", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Indietro" }).click();
    await expect(page.getByLabel("Nome dell'azienda")).toHaveValue("Studio Rossi");
    await expect(page.getByLabel("Partita IVA (facoltativa)")).toHaveValue("01234567897");
    await expect(page.getByLabel("Tipo")).toHaveValue("srl");
    await expect(page.getByAltText("Anteprima del logo")).toBeVisible();
    await avanti(page);
  });

  test("passo 3: validazione dell'amministratore", async () => {
    await avanti(page);
    await expect(page.getByText("Inserisci il nome", { exact: true })).toBeVisible();
    await page.locator('input[name="nome"]').fill("Mario");
    await page.locator('input[name="cognome"]').fill("Rossi");
    await page.locator('input[name="email"]').fill("non-una-email");
    await page.locator('input[name="password"]').fill("corta");
    await page.locator('input[name="conferma"]').fill("diversa");
    await avanti(page);
    await expect(page.getByText("Email non valida")).toBeVisible();
    await expect(page.getByText(/almeno 12 caratteri/).first()).toBeVisible();
    await expect(page.getByText("Le password non coincidono")).toBeVisible();
    expect(await conta("users")).toBe(0);
  });

  test("passo 3: salva l'amministratore (solo l'hash della password nella bozza)", async () => {
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('input[name="conferma"]').fill(PASSWORD);
    await avanti(page);
    await expect(page.getByRole("heading", { name: "Sicurezza", level: 2 })).toBeVisible();
    // la password non è mai finita in chiaro nel database, e nessun utente è ancora stato creato
    const bozza = await sql`select valore from impostazioni where chiave = 'setup.bozza'`;
    expect(JSON.stringify(bozza[0].valore)).not.toContain(PASSWORD);
    expect(JSON.stringify(bozza[0].valore)).toContain("passwordHash");
    expect(await conta("users")).toBe(0);
  });

  test("passo 4: la password scelta deve rispettare il minimo; poi si va avanti", async () => {
    await expect(page.getByText("Segreto di autenticazione impostato")).toBeVisible();
    await expect(page.getByText(/Configurazione protetta da codice/)).toBeVisible();
    await page.getByLabel("Lunghezza minima delle password").selectOption("16");
    await avanti(page); // la password ha 27 caratteri: va bene anche con 16
    await expect(page.getByRole("heading", { name: "Preferenze", level: 2 })).toBeVisible();
  });

  test("passo 5: preferenze con anteprima della numerazione", async () => {
    await page.getByLabel("Numerazione dei preventivi").fill("PREV");
    await avanti(page);
    await expect(page.getByText("Il formato deve contenere il numero progressivo")).toBeVisible();
    await page.getByLabel("Numerazione dei preventivi").fill("PV-{AAAA}-{NNNN}");
    await expect(page.getByText(`Esempio: PV-${new Date().getFullYear()}-0001`)).toBeVisible();
    await page.getByLabel("Aliquota IVA (%)").fill("22,5");
    await avanti(page);
    await expect(page.getByRole("heading", { name: "Conferma", level: 2 })).toBeVisible();
  });

  test("passo 6: riepilogo senza password e conferma obbligatoria", async () => {
    await expect(page.getByText("Studio Rossi")).toBeVisible();
    await expect(page.getByText(EMAIL)).toBeVisible();
    await expect(page.getByText(PASSWORD)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inizializza Telaio" })).toBeDisabled();
    await page.getByLabel("Ho controllato i dati e voglio inizializzare Telaio.").check();
    await expect(page.getByRole("button", { name: "Inizializza Telaio" })).toBeEnabled();
  });

  test("un errore durante l'inizializzazione non crea nulla e permette di riprovare", async () => {
    // Un conflitto fa fallire la transazione dopo aver inserito azienda e amministratore.
    await sql`insert into impostazioni (chiave, valore) values ('generali', '{}'::jsonb)`;
    await page.getByRole("button", { name: "Inizializza Telaio" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "non è stato salvato nulla" }),
    ).toBeVisible();
    expect(await conta("users")).toBe(0);
    expect(await conta("ragioni_sociali")).toBe(0);
    const stato = await sql`select 1 from impostazioni where chiave = 'setup'`;
    expect(stato).toHaveLength(0);
    // la bozza è ancora lì: dopo un refresh si riprende dal riepilogo
    await page.reload();
    await expect(page.getByRole("heading", { name: "Conferma", level: 2 })).toBeVisible();
    await sql`delete from impostazioni where chiave = 'generali'`;
  });

  test("due inizializzazioni contemporanee: ne riesce una sola", async ({ browser }) => {
    const a = await nuovoContesto(browser);
    const b = await nuovoContesto(browser);
    await accedi(a.page);
    await accedi(b.page);
    for (const { page: p } of [a, b]) {
      await expect(p.getByRole("heading", { name: "Conferma", level: 2 })).toBeVisible();
      await p.getByLabel("Ho controllato i dati e voglio inizializzare Telaio.").check();
    }
    await Promise.all([
      a.page.getByRole("button", { name: "Inizializza Telaio" }).click(),
      b.page.getByRole("button", { name: "Inizializza Telaio" }).click(),
    ]);
    // chi vince va al login; chi perde, o va al login (setup già completato) o vede un messaggio chiaro
    await expect(a.page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(b.page).toHaveURL(/\/login/, { timeout: 30_000 });
    expect(await conta("users")).toBe(1);
    expect(await conta("accounts")).toBe(1);
    expect(await conta("ragioni_sociali")).toBe(1);
    await a.ctx.close();
    await b.ctx.close();
  });

  test("configurazione completata: stato nel database e dati creati", async () => {
    const [setup] = await sql`select valore from impostazioni where chiave = 'setup'`;
    expect(setup.valore).toMatchObject({
      setup_completed: true,
      setup_version: 1,
      origine: "wizard",
    });
    expect(new Date(setup.valore.setup_completed_at).getTime()).toBeGreaterThan(0);
    const [u] = await sql`select name, email, role from users`;
    expect(u).toEqual({ name: "Mario Rossi", email: EMAIL, role: "admin" });
    const [rs] =
      await sql`select nome, partita_iva, aliquota_iva_bp, formato_preventivo from ragioni_sociali`;
    expect(rs).toEqual({
      nome: "Studio Rossi",
      partita_iva: "01234567897",
      aliquota_iva_bp: 2250,
      formato_preventivo: "PV-{AAAA}-{NNNN}",
    });
    const chiavi = (await sql`select chiave from impostazioni order by chiave`).map(
      (r: { chiave: string }) => r.chiave,
    );
    expect(chiavi).toEqual(["azienda.logo", "generali", "setup", "sicurezza"]);
    expect(await conta("conti")).toBe(0);
    expect(await conta("listini")).toBe(0);
    [{ password: hashAccount }] = await sql`select password from accounts limit 1`;
  });

  test("/setup dopo il completamento non è più accessibile", async () => {
    // il cookie di accesso al wizard c'è ancora, ma non basta
    for (const percorso of ["/setup", "/setup/"]) {
      await page.goto(percorso);
      await expect(page, percorso).toHaveURL(/\/login/);
    }
    await expect(page.getByLabel("Nome dell'azienda")).toHaveCount(0);
  });

  test("a configurazione completata il codice giusto non emette più il cookie di accesso", async ({
    request,
  }) => {
    const giusta = azioniViste.find((a) => a.body.includes(CODICE));
    expect(giusta, "azione verificaCodice non intercettata").toBeTruthy();
    const r = await request.post("/setup", {
      headers: {
        "content-type": giusta?.contentType ?? "text/plain;charset=UTF-8",
        "next-action": giusta?.id ?? "",
        origin: process.env.E2E_BASE_URL as string,
      },
      data: giusta?.body,
      maxRedirects: 0,
    });
    const testo = await r.text();
    expect(testo).not.toContain('"ok":true');
    expect(r.headers()["set-cookie"] ?? "").not.toContain("telaio-setup");
  });

  test("il login funziona con le credenziali scelte e porta alla guida di sicurezza", async () => {
    await page.goto("/login?setup=ok&dopo=sicurezza");
    await expect(page.getByText("Configurazione completata")).toBeVisible();
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(page).toHaveURL(/\/impostazioni\/sicurezza$/);
    await expect(page.getByRole("heading", { name: "Verifica in due passaggi" })).toBeVisible();
  });

  test("da autenticato, /setup rimanda alla dashboard", async () => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("la politica sulla lunghezza minima vale anche per il cambio password", async ({
    request,
  }) => {
    // la sessione del browser non serve: si prova con la stessa sessione via API
    const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const r = await request.post("/api/auth/change-password", {
      headers: { cookie, origin: process.env.E2E_BASE_URL as string },
      data: { currentPassword: PASSWORD, newPassword: "x".repeat(15) },
    });
    expect(r.status()).toBe(400);
    expect(JSON.stringify(await r.json())).toContain("almeno 16 caratteri");
  });

  test("cancellare gli utenti non riapre il setup", async ({ browser }) => {
    const { ctx: c, page: p } = await nuovoContesto(browser);
    await sql`delete from sessions`;
    await sql`delete from accounts`;
    await sql`delete from users`;
    expect(await conta("users")).toBe(0);
    for (const percorso of ["/", "/setup", "/clienti"]) {
      await p.goto(percorso);
      await expect(p, percorso).toHaveURL(/\/login/);
    }
    // e nessun amministratore può nascere da una richiesta forgiata alla pagina di setup
    const r = await p.request.post("/setup", {
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": "00",
        origin: process.env.E2E_BASE_URL as string,
      },
      data: "[]",
      maxRedirects: 0,
    });
    expect(r.status()).not.toBe(200);
    expect(await conta("users")).toBe(0);
    await c.close();
  });

  test("nessuna informazione sensibile è arrivata al browser", async () => {
    expect(ricevuto.length).toBeGreaterThan(10);
    const tutto = ricevuto.join("\n");
    for (const segreto of SEGRETI_DA_NON_VEDERE)
      expect(tutto, `trovato: ${segreto.slice(0, 6)}…`).not.toContain(segreto);
    expect(tutto).not.toMatch(/\$argon2|scrypt|passwordHash/i);
    // l'hash vero della password non è mai passato dal browser
    expect(hashAccount.length).toBeGreaterThan(20);
    expect(tutto).not.toContain(hashAccount);
  });
});
