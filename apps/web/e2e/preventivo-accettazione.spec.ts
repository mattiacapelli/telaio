import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";

// Gira sul database di sviluppo con l'utente del seed, come le altre suite.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";
const PREFISSO = "E2E accettazione";
const CLIENTE = "E2E accettazione cliente";
const REGOLE = {
  ivaAttiva: true,
  aliquotaIvaBp: 2200,
  bolloAutomatico: false,
  splitPayment: false,
};
const G = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test.describe.configure({ mode: "serial" });

let rsId = "";
let clienteId = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

/** Sito 1000 + SEO 300 (una tantum), manutenzione 600/anno oppure 60/mese, hosting 50/mese. */
async function preventivo(nome: string, conGruppo = true, stato = "inviato"): Promise<string> {
  const [p] = await sql`
    insert into preventivi (ragione_sociale_id, cliente_ref_id, anno, stato, numero, oggetto, snapshot,
                            imponibile_cent, iva_cent, totale_cent)
    values (${rsId}, ${clienteId}, 2026, ${stato}::stato_preventivo, ${`E2E-${nome}`}, ${`${PREFISSO} ${nome}`},
            ${sql.json({ emittente: {}, cliente: { nome: CLIENTE }, regole: REGOLE })}, 130000, 28600, 158600)
    returning id`;
  const righe: [string, string, number, string | null][] = [
    ["Sito web", "una_tantum", 100000, null],
    ["SEO", "una_tantum", 30000, null],
    ...(conGruppo
      ? ([
          ["Manutenzione — canone annuo", "canone_annuo", 60000, G],
          ["Manutenzione — canone mensile", "canone_mensile", 6000, G],
        ] as [string, string, number, string | null][])
      : []),
    ["Hosting", "canone_mensile", 5000, null],
  ];
  for (const [i, [d, tipo, c, g]] of righe.entries())
    await sql`insert into preventivo_righe (preventivo_id, posizione, descrizione, tipo, prezzo_unitario_cent, importo_cent, gruppo_alternativa_id)
              values (${p.id}, ${i}, ${d}, ${tipo}::tipo_riga, ${c}, ${c}, ${g})`;
  return p.id;
}

async function pulisci() {
  const prev = await sql`select id from preventivi where oggetto like ${`${PREFISSO}%`}`;
  for (const { id } of prev) {
    const fatt = await sql`select id from fatture where preventivo_id = ${id}`;
    for (const f of fatt) {
      await sql`delete from fattura_righe where fattura_id = ${f.id}`;
      await sql`delete from fatture where id = ${f.id}`;
    }
    const ab = await sql`select id from abbonamenti where preventivo_id = ${id}`;
    for (const a of ab) {
      await sql`delete from rate where abbonamento_id = ${a.id}`;
      await sql`delete from abbonamenti where id = ${a.id}`;
    }
    await sql`delete from audit_log where entita_id = ${String(id)}`;
    await sql`delete from preventivo_righe where preventivo_id = ${id}`;
    await sql`delete from preventivi where id = ${id}`;
  }
  await sql`delete from clienti_ref where nome = ${CLIENTE}`;
}

test.beforeAll(async () => {
  await pulisci();
  [{ id: rsId }] =
    await sql`select id from ragioni_sociali where deleted_at is null order by created_at limit 1`;
  [{ id: clienteId }] = await sql`insert into clienti_ref (nome) values (${CLIENTE}) returning id`;
});
test.afterAll(async () => {
  await pulisci();
  await sql.end({ timeout: 2 });
});

test("accettazione parziale: righe escluse barrate, totali ricalcolati, abbonamenti e fattura corretti", async ({
  page,
}) => {
  const id = await preventivo("parziale");
  await accedi(page);
  await page.goto(`/preventivi/${id}`);
  await page.getByRole("button", { name: "Registra accettazione" }).click();
  const dialogo = page.getByRole("dialog");

  // parte tutto selezionato; le alternative vanno scelte esplicitamente
  await expect(dialogo.getByRole("checkbox", { name: /Sito web/ })).toBeChecked();
  await expect(dialogo.getByRole("checkbox", { name: /SEO/ })).toBeChecked();
  await expect(dialogo.getByRole("radio", { name: /Canone annuale/ })).not.toBeChecked();
  await expect(dialogo.getByRole("radio", { name: /Canone mensile/ })).not.toBeChecked();
  await expect(dialogo.getByRole("button", { name: /Conferma accettazione/ })).toBeDisabled();
  await expect(dialogo.getByText("Scegli le alternative")).toBeVisible();

  // il cliente non vuole la SEO e sceglie il canone annuale
  await dialogo.getByRole("checkbox", { name: /SEO/ }).uncheck();
  await dialogo.getByRole("radio", { name: /Canone annuale/ }).check();
  await expect(dialogo.getByText("Accettazione parziale", { exact: true })).toBeVisible();
  await expect(dialogo.getByText("Una tantum originale (imponibile)")).toBeVisible();
  await expect(dialogo.getByText("€ 1.300,00").first()).toBeVisible();
  await expect(dialogo.getByText("€ 1.220,00").first()).toBeVisible(); // 1000 + IVA 22%
  await dialogo.getByRole("button", { name: "Conferma accettazione parziale" }).click();

  await expect(page.getByText("Accettato parzialmente").first()).toBeVisible();
  // righe escluse: barrate, con l'indicazione; le accettate restano normali
  const escluse = page.locator("tr[data-esito=esclusa]");
  await expect(escluse).toHaveCount(2); // SEO e canone mensile della manutenzione
  await expect(escluse.first()).toContainText("SEO");
  await expect(page.getByText("Non accettata")).toBeVisible();
  await expect(page.getByText("Alternativa non scelta").first()).toBeVisible();
  await expect(page.locator("tr[data-esito=esclusa] td").first()).toHaveClass(/line-through/);
  await expect(page.getByText("Imponibile originale")).toBeVisible();
  await expect(page.getByText("Totale accettato")).toBeVisible();

  const [p] = await sql`select * from preventivi where id = ${id}`;
  expect(p).toMatchObject({
    stato: "accettato_parzialmente",
    imponibile_cent: 130000, // offerta originale intatta
    imponibile_accettato_cent: 100000,
    iva_accettata_cent: 22000,
    totale_accettato_cent: 122000,
  });
  const righe =
    await sql`select descrizione, accettata from preventivo_righe where preventivo_id = ${id} order by posizione`;
  expect(righe.map((r: { accettata: boolean }) => r.accettata)).toEqual([
    true,
    false,
    true,
    false,
    true,
  ]);
  const ab =
    await sql`select descrizione, periodicita, importo_rata_cent from abbonamenti where preventivo_id = ${id} order by descrizione`;
  expect(ab).toHaveLength(2);
  expect(ab.map((a: { periodicita: string }) => a.periodicita).sort()).toEqual([
    "annuale",
    "mensile",
  ]);
  expect(
    (
      await sql`select count(*)::int n from rate r join abbonamenti a on a.id = r.abbonamento_id where a.preventivo_id = ${id}`
    )[0].n,
  ).toBeGreaterThan(12);
  const azioni = await sql`select azione, dettagli from audit_log where entita_id = ${id}`;
  expect(azioni.map((a: { azione: string }) => a.azione)).toEqual([
    "preventivo.accettato_parzialmente",
  ]);
  expect(azioni[0].dettagli.totaliAccettati.totaleCent).toBe(122000);
  expect(azioni[0].dettagli.righeEscluse).toHaveLength(2);

  // la fattura contiene solo la prestazione accettata, e non i canoni
  await page.getByRole("button", { name: "Converti in fattura" }).click();
  await expect(page).toHaveURL(/\/fatture\/[0-9a-f-]{36}$/);
  const [f] = await sql`select * from fatture where preventivo_id = ${id}`;
  expect(f).toMatchObject({ imponibile_cent: 100000, iva_cent: 22000, totale_cent: 122000 });
  const fr = await sql`select descrizione from fattura_righe where fattura_id = ${f.id}`;
  expect(fr.map((r: { descrizione: string }) => r.descrizione)).toEqual(["Sito web"]);

  // il preventivo ora rimanda alla fattura: non se ne può creare un'altra
  await page.goto(`/preventivi/${id}`);
  await expect(page.getByRole("button", { name: "Converti in fattura" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Vai alla fattura" })).toBeVisible();
  // la riga di una proposta accettata non si può più decidere
  await expect(page.getByRole("button", { name: "Registra accettazione" })).toHaveCount(0);
});

test("accettazione totale senza alternative: tutto selezionato, un clic", async ({ page }) => {
  const id = await preventivo("totale", false);
  await accedi(page);
  await page.goto(`/preventivi/${id}`);
  await page.getByRole("button", { name: "Registra accettazione" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByText("Accettazione totale", { exact: true })).toBeVisible();
  await dialogo
    .getByLabel("Data decorrenza abbonamenti")
    .fill(new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10));
  await dialogo.getByRole("button", { name: "Conferma accettazione totale" }).click();
  await expect(dialogo).toBeHidden(); // l'azione è finita: il database è aggiornato
  await expect(page.locator("tr[data-esito=esclusa]")).toHaveCount(0);
  const [p] =
    await sql`select stato, totale_accettato_cent, imponibile_accettato_cent from preventivi where id = ${id}`;
  expect(p).toMatchObject({
    stato: "accettato",
    imponibile_accettato_cent: 130000,
    totale_accettato_cent: 158600,
  });
  const [ab] =
    await sql`select inizio::text, importo_rata_cent from abbonamenti where preventivo_id = ${id}`;
  expect(ab.importo_rata_cent).toBe(5000);
  expect(new Date(ab.inizio).getTime()).toBeGreaterThan(Date.now() + 30 * 86400000);
});

test("senza nulla di accettato si propone il rifiuto", async ({ page }) => {
  const id = await preventivo("rifiuto");
  await accedi(page);
  await page.goto(`/preventivi/${id}`);
  await page.getByRole("button", { name: "Registra accettazione" }).click();
  const dialogo = page.getByRole("dialog");
  for (const nome of [/Sito web/, /SEO/, /Hosting/])
    await dialogo.getByRole("checkbox", { name: nome }).uncheck();
  await dialogo.getByRole("radio", { name: /Nessuna delle due/ }).check();
  await expect(dialogo.getByRole("button", { name: /Conferma accettazione/ })).toHaveCount(0);
  await dialogo.getByRole("button", { name: "Rifiuta il preventivo" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText("Rifiutato").first()).toBeVisible();
  const [p] = await sql`select stato, totale_accettato_cent from preventivi where id = ${id}`;
  expect(p).toMatchObject({ stato: "rifiutato", totale_accettato_cent: null });
  expect(
    (
      await sql`select count(*)::int n from preventivo_righe where preventivo_id = ${id} and accettata is not false`
    )[0].n,
  ).toBe(0);
  expect(
    (await sql`select count(*)::int n from abbonamenti where preventivo_id = ${id}`)[0].n,
  ).toBe(0);
});

test("elenco: stato parziale, abbonamenti per servizio con «oppure», filtro e PDF", async ({
  page,
  request,
}) => {
  const prima = await preventivo("elenco");
  await accedi(page);
  await page.goto("/preventivi");
  await page.getByPlaceholder("Numero, cliente, oggetto, servizio…").fill(`${PREFISSO} elenco`);
  const riga = page.locator("tr", { hasText: `${PREFISSO} elenco` });
  // prima dell'accettazione: entrambe le alternative, mai sommate
  await expect(riga).toContainText("Manutenzione");
  await expect(riga).toContainText("oppure");
  await expect(riga).toContainText("€ 600/anno");
  await expect(riga).toContainText("€ 60/mese");
  await expect(riga).toContainText("Hosting");
  await expect(page.getByText("Accettati parzialmente").first()).toBeVisible();

  // dopo l'accettazione: solo la periodicità scelta
  await page.goto(`/preventivi/${prima}`);
  await page.getByRole("button", { name: "Registra accettazione" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("radio", { name: /Canone mensile/ }).check();
  await dialogo.getByRole("button", { name: "Conferma accettazione totale" }).click();
  await expect(dialogo).toBeHidden(); // l'azione è finita
  await expect(page.getByText("Accettato").first()).toBeVisible();
  await page.goto("/preventivi");
  await page.getByPlaceholder("Numero, cliente, oggetto, servizio…").fill(`${PREFISSO} elenco`);
  const dopo = page.locator("tr", { hasText: `${PREFISSO} elenco` });
  await expect(dopo).toContainText("€ 60/mese");
  await expect(dopo).not.toContainText("€ 600/anno");
  await expect(dopo).not.toContainText("oppure");

  // PDF dell'accettato
  const cookie = await page.context().cookies();
  const r = await request.get(`/api/pdf/preventivi/${prima}`, {
    headers: { cookie: cookie.map((c) => `${c.name}=${c.value}`).join("; ") },
  });
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/pdf");
  expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("l'accettazione non è disponibile per le bozze, e la fattura non per i preventivi inviati", async ({
  page,
}) => {
  const bozza = await preventivo("bozza", true, "bozza");
  const inviato = await preventivo("inviato");
  await accedi(page);
  await page.goto(`/preventivi/${bozza}`);
  await expect(page.getByRole("button", { name: "Registra accettazione" })).toHaveCount(0);
  await page.goto(`/preventivi/${inviato}`);
  await expect(page.getByRole("button", { name: "Registra accettazione" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Converti in fattura" })).toHaveCount(0);
});
