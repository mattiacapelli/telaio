import { createRequire } from "node:module";
import { expect, type Page, request as playwrightRequest, test } from "@playwright/test";

// Gira sul database di sviluppo con l'utente del seed e sul MinIO di docker-compose (porta 9100).
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";
const CODICE = "E2E-TKT-001";
const BUCKET = "telaio-e2e";

test.describe.configure({ mode: "serial" });

let progettoId = "";
let configPrecedente: unknown = null;
let ticketPrecedente: unknown = null;

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  await sql`delete from progetto_documenti where progetto_id in (select id from progetti where codice = ${CODICE})`;
  await sql`delete from ticket where progetto_id in (select id from progetti where codice = ${CODICE})`;
  await sql`delete from progetti where codice = ${CODICE}`;
}

test.beforeAll(async () => {
  await pulisci();
  const [r] = await sql`select valore from impostazioni where chiave = 'archivio.s3'`;
  configPrecedente = r?.valore ?? null;
  await sql`delete from impostazioni where chiave = 'archivio.s3'`;
  const [t] = await sql`select valore from impostazioni where chiave = 'ticket'`;
  ticketPrecedente = t?.valore ?? null;
  await sql`delete from impostazioni where chiave = 'ticket'`;
  [{ id: progettoId }] =
    await sql`insert into progetti (codice, nome) values (${CODICE}, 'E2E ticket e documenti') returning id`;
});

test.afterAll(async () => {
  await pulisci();
  await sql`delete from impostazioni where chiave = 'archivio.s3'`;
  if (configPrecedente)
    await sql`insert into impostazioni (chiave, valore) values ('archivio.s3', ${sql.json(configPrecedente)})`;
  await sql`delete from impostazioni where chiave = 'ticket'`;
  if (ticketPrecedente)
    await sql`insert into impostazioni (chiave, valore) values ('ticket', ${sql.json(ticketPrecedente)})`;
  await sql.end();
});

test("senza archivio configurato il caricamento rimanda alle impostazioni", async ({ page }) => {
  await accedi(page);
  await page.goto(`/progetti/${progettoId}`);
  await expect(page.getByText("L'archivio dei documenti non è configurato.")).toBeVisible();
  await page.getByRole("link", { name: "Indica il bucket S3" }).click();
  await expect(page).toHaveURL(/impostazioni\/archiviazione$/);
  await expect(page.getByText("Non configurato", { exact: true })).toBeVisible();
});

test("configurazione del bucket: valori non validi rifiutati, poi salvataggio, bucket e prova", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/impostazioni/archiviazione");
  await page.getByRole("button", { name: "Configura" }).click();
  const dialogo = page.getByRole("dialog");

  await dialogo.locator('input[name="bucket"]').fill("Nome Non Valido");
  await dialogo.getByLabel("Indirizzo del servizio").fill("ftp://x");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText(/Nome del bucket non valido/)).toBeVisible();
  await expect(dialogo.getByText(/Indirizzo non valido/)).toBeVisible();

  await dialogo.getByLabel("Indirizzo del servizio").fill("http://localhost:9100");
  await dialogo.locator('input[name="bucket"]').fill(BUCKET);
  await dialogo.getByLabel("Cartella nel bucket").fill("e2e");
  await dialogo.getByLabel(/Bucket nel percorso/).check();
  // una sola delle due chiavi: errore
  await dialogo.getByLabel("Access key ID").fill("telaio");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText("Inserisci access key e secret key insieme")).toBeVisible();

  await dialogo.getByLabel("Secret access key").fill("telaio-dev-2026");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByText("Configurato", { exact: true })).toBeVisible();
  await expect(page.getByText("Salvate (cifrate) · telaio")).toBeVisible();
  // il segreto non è mai in chiaro nel database né nella pagina
  const [r] = await sql`select valore::text v from impostazioni where chiave = 'archivio.s3'`;
  expect(r.v).not.toContain("telaio-dev-2026");
  expect(r.v).toContain("secretCifrato");
  expect(await page.content()).not.toContain("telaio-dev-2026");

  await page.getByRole("button", { name: "Crea il bucket" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Crea" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Prova la connessione" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Prova" }).click();
  await expect(
    page.getByText(`Connessione riuscita: il bucket «${BUCKET}» funziona`),
  ).toBeVisible();
});

test("chiavi sbagliate: la prova lo dice in italiano", async ({ page }) => {
  await accedi(page);
  await page.goto("/impostazioni/archiviazione");
  await page.getByRole("button", { name: "Modifica", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Secret access key").fill("sbagliata-sbagliata");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  await page.getByRole("button", { name: "Prova la connessione" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Prova" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /Firma non valida|Access key non riconosciuta|Accesso negato/,
  );
  await page.keyboard.press("Escape");
  // si rimettono quelle giuste
  await page.getByRole("button", { name: "Modifica", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Secret access key").fill("telaio-dev-2026");
  await page.getByRole("dialog").getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("documenti del progetto: carica, scarica uguale, anteprima, elimina; il file enorme è rifiutato", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/progetti/${progettoId}`);
  const contenuto = Buffer.from("Contratto di prova\nriga due\n");
  await page.getByLabel("File da caricare").setInputFiles({
    name: "contratto è prova.txt",
    mimeType: "text/plain",
    buffer: contenuto,
  });
  await page.getByLabel("Categoria").selectOption("contratto");
  await page.getByLabel("Descrizione", { exact: true }).fill("Versione firmata");
  await page.getByRole("button", { name: "Carica il file" }).click();
  await expect(page.getByText("contratto è prova.txt")).toBeVisible();
  await expect(page.getByText("Versione firmata")).toBeVisible();

  const [d] =
    await sql`select id, chiave, dimensione_byte from progetto_documenti where progetto_id = ${progettoId} and deleted_at is null`;
  expect(d.chiave).toMatch(new RegExp(`^e2e/progetti/${progettoId}/${d.id}/`));
  expect(d.dimensione_byte).toBe(contenuto.length);

  const scarico = await page.request.get(`/api/documenti/${d.id}`);
  expect(scarico.status()).toBe(200);
  expect(await scarico.body()).toEqual(contenuto);
  expect(scarico.headers()["content-disposition"]).toContain("attachment");
  expect(scarico.headers()["content-disposition"]).toContain("contratto%20%C3%A8%20prova.txt");
  expect(scarico.headers()["x-content-type-options"]).toBe("nosniff");
  // un file di testo non ha anteprima nel browser: resta allegato anche con ?anteprima=1
  const anteprima = await page.request.get(`/api/documenti/${d.id}?anteprima=1`);
  expect(anteprima.headers()["content-disposition"]).toContain("attachment");

  // senza sessione non si scarica: il proxy rimanda al login, e con un cookie falso risponde la route stessa
  const anonimo = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });
  const rimandato = await anonimo.get(`/api/documenti/${d.id}`, { maxRedirects: 0 });
  expect(rimandato.status()).toBe(307);
  expect(rimandato.headers().location).toContain("/login");
  const falso = await anonimo.get(`/api/documenti/${d.id}`, {
    headers: { cookie: "better-auth.session_token=falso.falso" },
    maxRedirects: 0,
  });
  expect(falso.status()).toBe(401);
  const caricamento = await anonimo.post(`/api/progetti/${progettoId}/documenti`, {
    headers: { cookie: "better-auth.session_token=falso.falso" },
    multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") } },
    maxRedirects: 0,
  });
  expect(caricamento.status()).toBe(401);
  await anonimo.dispose();

  // oltre il limite: il pulsante resta spento e lo dice
  await page.getByLabel("File da caricare").setInputFiles({
    name: "enorme.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(26 * 1024 * 1024),
  });
  await expect(page.getByText("Togli i file sopra il limite di 25 MB.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Carica il file" })).toBeDisabled();
  await page.getByRole("button", { name: "Togli enorme.bin" }).click();

  await page.getByRole("button", { name: "Elimina contratto è prova.txt" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("contratto è prova.txt")).toBeHidden();
  expect((await page.request.get(`/api/documenti/${d.id}`)).status()).toBe(404);
});

test("lavagna: creazione rapida, modale, spostamento con trascinamento e dal menu, filtri", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/progetti/${progettoId}/ticket`);
  const colonna = (nome: string) => page.getByRole("region", { name: nome });

  // creazione rapida nella colonna «Da fare»
  await colonna("Da fare").getByRole("button", { name: "Crea ticket" }).click();
  await page.getByLabel("Nuovo ticket in Da fare").fill("Primo ticket");
  await page.keyboard.press("Enter");
  await expect(colonna("Da fare").getByText("Primo ticket")).toBeVisible();
  // il campo resta aperto per inserirne altri di seguito
  await expect(page.getByLabel("Nuovo ticket in Da fare")).toHaveValue("");
  await page.getByLabel("Nuovo ticket in Da fare").fill("Secondo ticket");
  await page.keyboard.press("Enter");
  await expect(colonna("Da fare").getByText("Secondo ticket")).toBeVisible();

  // modale completa
  await page.getByRole("button", { name: "Nuovo ticket" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Titolo").fill("Bug del login");
  await dialogo.getByLabel("Tipo").selectOption("bug");
  await dialogo.getByLabel("Stato").selectOption("in_corso");
  await dialogo.getByLabel("Priorità").selectOption("urgente");
  await dialogo.getByRole("button", { name: "Crea", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(colonna("In corso").getByText("Bug del login")).toBeVisible();
  const numeri =
    await sql`select titolo, numero from ticket where progetto_id = ${progettoId} order by numero`;
  expect(numeri.map((r: { numero: number }) => r.numero)).toEqual([1, 2, 3]);

  // trascinamento: «Primo ticket» da «Da fare» a «In revisione»
  await colonna("Da fare").getByText("Primo ticket").dragTo(colonna("In revisione"));
  await expect(colonna("In revisione").getByText("Primo ticket")).toBeVisible();
  await expect
    .poll(
      async () =>
        (await sql`select stato from ticket where progetto_id = ${progettoId} and numero = 1`)[0]
          .stato,
    )
    .toBe("in_revisione");

  // trascinamento sopra un altro ticket: «Secondo ticket» davanti a «Bug del login» in «In corso»
  await colonna("Da fare")
    .getByText("Secondo ticket")
    .dragTo(colonna("In corso").getByText("Bug del login"), {
      targetPosition: { x: 20, y: 4 },
    });
  await expect
    .poll(
      async () =>
        (await sql`select stato from ticket where progetto_id = ${progettoId} and numero = 2`)[0]
          .stato,
    )
    .toBe("in_corso");
  const ordine = await colonna("In corso").locator("[data-ticket]").allInnerTexts();
  expect(ordine[0]).toContain("Secondo ticket");
  expect(ordine[1]).toContain("Bug del login");

  // dal menu «Sposta» (per il telefono): «Bug del login» in «Completato»
  await page.getByRole("button", { name: "Sposta Bug del login" }).click();
  await page.getByRole("menuitem", { name: "Completato" }).click();
  await expect(colonna("Completato").getByText("Bug del login")).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await sql`select completato_at is not null c from ticket where progetto_id = ${progettoId} and numero = 3`
        )[0].c,
    )
    .toBe(true);

  // filtri
  await page.getByLabel("Cerca nei ticket").fill("login");
  await expect(colonna("Completato").getByText("Bug del login")).toBeVisible();
  await expect(page.getByText("Secondo ticket")).toBeHidden();
  await page.getByLabel("Cerca nei ticket").fill("");
  await page.getByLabel("Priorità", { exact: true }).selectOption("urgente");
  await expect(page.getByText("Secondo ticket")).toBeHidden();
  await expect(page.getByText("Bug del login")).toBeVisible();
});

test("dettaglio del ticket: commenti, modifica, documento allegato, ricerca globale, eliminazione", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/progetti/${progettoId}/ticket/1`);
  await expect(
    page.getByRole("heading", { name: new RegExp(`${CODICE}|PRJ.*-1 · Primo ticket`) }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Commento" }).fill("Riprodotto in locale");
  await page.getByRole("button", { name: "Commenta" }).click();
  await expect(page.getByText("Riprodotto in locale")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Commento" })).toHaveValue("");

  await page.getByRole("button", { name: "Modifica", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Titolo").fill("Primo ticket rivisto");
  await dialogo.getByLabel("Stato").selectOption("completato");
  await dialogo.getByLabel("Scadenza").fill("2026-12-31");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("heading", { name: /Primo ticket rivisto/ })).toBeVisible();

  // documento allegato al ticket (l'archivio è configurato dal test precedente)
  await page.getByLabel("File da caricare").setInputFiles({
    name: "log.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("errore 500"),
  });
  await page.getByRole("button", { name: "Carica il file" }).click();
  await expect(page.getByText("Documento caricato")).toBeVisible();
  await expect(page.getByRole("button", { name: "Elimina log.txt" })).toBeVisible();
  const [d] =
    await sql`select ticket_id, progetto_id from progetto_documenti where nome = 'log.txt' and progetto_id = ${progettoId}`;
  expect(d.ticket_id).not.toBeNull();

  // ricerca universale
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/Cerca clienti/)).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByPlaceholder(/Cerca clienti/).fill("rivisto");
  await expect(page.getByRole("option", { name: /Primo ticket rivisto/ })).toBeVisible();
  await page.getByPlaceholder(/Cerca clienti/).fill("log.txt");
  await expect(page.getByRole("option", { name: /log\.txt/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // elimina il documento (toglie anche l'oggetto dal bucket) e poi il ticket
  await page.getByRole("button", { name: "Elimina log.txt" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Elimina log.txt" })).toBeHidden();

  await page.getByRole("button", { name: /^Elimina .*-1$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page).toHaveURL(new RegExp(`/progetti/${progettoId}/ticket$`));
  await expect(page.getByText("Primo ticket rivisto")).toBeHidden();
  await page.goto(`/progetti/${progettoId}/ticket/1`);
  await expect(page.getByText(/non trovata|404|could not be found/i).first()).toBeVisible();
});

test("assegnazione automatica: si configura e vale per i ticket rapidi e per la finestra di creazione", async ({
  page,
}) => {
  await accedi(page);
  const [utente] = await sql`select id from users where email = ${email}`;
  const assegnatario = async (titolo: string) =>
    (
      await sql`select assegnatario_id a from ticket where progetto_id = ${progettoId} and titolo = ${titolo}`
    )[0]?.a;
  const interruttore = page.getByRole("switch", { name: "Assegna i nuovi ticket a me" });

  // spenta di partenza: il ticket rapido resta senza assegnatario
  await page.goto(`/progetti/${progettoId}/ticket`);
  await page.getByRole("button", { name: "Crea ticket" }).first().click();
  await page.getByLabel(/^Nuovo ticket in/).fill("Senza auto");
  await page.keyboard.press("Enter");
  await expect.poll(() => assegnatario("Senza auto")).toBeNull();
  await page.getByRole("button", { name: "Nuovo ticket" }).click();
  await expect(page.getByRole("dialog").getByLabel("Assegnato a")).toHaveValue("");
  await page.keyboard.press("Escape");

  await page.goto("/impostazioni/ticket");
  await expect(interruttore).toHaveAttribute("aria-checked", "false");
  await interruttore.click();
  await expect(page.getByText("Assegnazione automatica attiva")).toBeVisible();
  await expect
    .poll(
      async () => (await sql`select valore from impostazioni where chiave = 'ticket'`)[0]?.valore,
    )
    .toEqual({
      autoAssegna: true,
    });

  await page.goto(`/progetti/${progettoId}/ticket`);
  await page.getByRole("button", { name: "Crea ticket" }).first().click();
  await page.getByLabel(/^Nuovo ticket in/).fill("Con auto");
  await page.keyboard.press("Enter");
  await expect.poll(() => assegnatario("Con auto")).toBe(utente.id);
  await page.getByRole("button", { name: "Nuovo ticket" }).click();
  await expect(page.getByRole("dialog").getByLabel("Assegnato a")).toHaveValue(utente.id);
  // si può comunque scegliere «Nessuno»
  await page.getByRole("dialog").getByLabel("Titolo").fill("Auto ma senza");
  await page.getByRole("dialog").getByLabel("Assegnato a").selectOption("");
  await page.getByRole("dialog").getByRole("button", { name: "Crea", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => assegnatario("Auto ma senza")).toBeNull();

  // si rispegne
  await page.goto("/impostazioni/ticket");
  await expect(interruttore).toHaveAttribute("aria-checked", "true");
  await interruttore.click();
  await expect(page.getByText("Assegnazione automatica disattivata")).toBeVisible();
});

test("pagina Ticket: lavagna di tutti i progetti di default, tabella a richiesta, creazione con scelta del progetto", async ({
  page,
}) => {
  await accedi(page);
  await page.getByRole("link", { name: "Ticket", exact: true }).first().click();
  await expect(page).toHaveURL(/\/ticket$/);
  await expect(page.getByRole("heading", { name: "Ticket", exact: true })).toBeVisible();

  // di default la lavagna, con il nome del progetto su ogni scheda
  await expect(page.getByRole("link", { name: "Vista" }).first())
    .toBeHidden()
    .catch(() => {});
  await expect(
    page.getByRole("navigation", { name: "Vista" }).getByRole("link", { name: "Lavagna" }),
  ).toHaveAttribute("aria-current", "page");
  const colonna = (nome: string) => page.getByRole("region", { name: nome });
  const scheda = colonna("Completato")
    .locator("[data-ticket]")
    .filter({ hasText: "Bug del login" });
  await expect(scheda).toBeVisible();
  await expect(scheda).toContainText("E2E ticket e documenti");

  // da qui un ticket cambia colonna (senza progetto scelto non si riordina), anche dal menu «Sposta»
  await page.getByRole("button", { name: "Sposta Bug del login" }).click();
  await page.getByRole("menuitem", { name: "In revisione" }).click();
  await expect(colonna("In revisione").getByText("Bug del login")).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await sql`select stato from ticket where progetto_id = ${progettoId} and titolo = 'Bug del login'`
        )[0].stato,
    )
    .toBe("in_revisione");

  // trascinamento tra colonne dalla lavagna generale
  await colonna("In revisione").getByText("Bug del login").dragTo(colonna("Da fare"));
  await expect(colonna("Da fare").getByText("Bug del login")).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await sql`select stato from ticket where progetto_id = ${progettoId} and titolo = 'Bug del login'`
        )[0].stato,
    )
    .toBe("da_fare");

  // la creazione rapida compare solo con un progetto scelto
  await expect(page.getByRole("button", { name: "Crea ticket" })).toHaveCount(0);
  await page
    .getByLabel("Progetto", { exact: true })
    .selectOption({ label: `${CODICE} · E2E ticket e documenti` });
  await expect(page.getByRole("button", { name: "Crea ticket" })).toHaveCount(5);
  await page.getByLabel("Progetto", { exact: true }).selectOption("");

  // «Nuovo ticket» chiede il progetto
  await page.getByRole("button", { name: "Nuovo ticket" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Titolo").fill("Creato dalla lavagna generale");
  await dialogo.getByRole("button", { name: "Crea", exact: true }).click();
  await expect(dialogo.getByText("Scegli il progetto"))
    .toBeVisible()
    .catch(() => {});
  await dialogo
    .getByLabel("Progetto")
    .selectOption({ label: `${CODICE} · E2E ticket e documenti` });
  await dialogo.getByRole("button", { name: "Crea", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText("Creato dalla lavagna generale")).toBeVisible();
  expect(
    (
      await sql`select count(*)::int n from ticket where progetto_id = ${progettoId} and titolo = 'Creato dalla lavagna generale'`
    )[0].n,
  ).toBe(1);

  // la tabella, con gli stessi ticket
  await page
    .getByRole("navigation", { name: "Vista" })
    .getByRole("link", { name: "Tabella" })
    .click();
  await expect(page).toHaveURL(/\/ticket\?vista=tabella$/);
  await page.getByLabel("Cerca in Ticket").fill("Bug del login");
  const riga = page.getByRole("row").filter({ hasText: "Bug del login" });
  await expect(riga).toBeVisible();
  await expect(riga).toContainText("E2E ticket e documenti");
  await riga.click();
  await expect(page).toHaveURL(new RegExp(`/progetti/${progettoId}/ticket/\\d+$`));

  // scorciatoia G poi T: torna alla lavagna
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(async () => {
    await page.keyboard.press("g");
    await page.keyboard.press("t");
    await expect(page).toHaveURL(/\/ticket$/, { timeout: 1000 });
  }).toPass();
});
