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
const OGGETTO = "E2E righe libere";

test.describe.configure({ mode: "serial" });

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  const ids = await sql`select id from preventivi where oggetto like ${`${OGGETTO}%`}`;
  for (const { id } of ids) {
    await sql`delete from preventivo_righe where preventivo_id = ${id}`;
    await sql`delete from preventivi where id = ${id}`;
  }
}

test.beforeAll(pulisci);
test.afterAll(async () => {
  await pulisci();
  await sql.end({ timeout: 2 });
});

test("si può creare un preventivo con sole righe scritte a mano, senza listino", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.locator("input[name=oggetto]").fill(OGGETTO);
  await page.getByLabel("Descrizione prestazione 1").fill("Consulenza una tantum");
  await page.getByLabel("Quantità prestazione 1").fill("2");
  await page.getByLabel("Prezzo prestazione 1").fill("150,00");
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 1").fill("Assistenza");
  await page.getByLabel("Periodicità abbonamento 1").selectOption("canone_mensile");
  await page.getByLabel("Prezzo abbonamento 1").fill("20");
  await expect(page.getByRole("button", { name: "Salva bozza" })).toBeEnabled();
  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);

  const righe = await sql`
    select r.descrizione, r.tipo, r.quantita, r.prezzo_unitario_cent, r.importo_cent, r.voce_listino_id,
           r.gruppo_alternativa_id, r.accettata
    from preventivo_righe r join preventivi p on p.id = r.preventivo_id
    where p.oggetto = ${OGGETTO} order by r.posizione`;
  expect(righe).toHaveLength(2);
  expect(righe[0]).toMatchObject({
    descrizione: "Consulenza una tantum",
    tipo: "una_tantum",
    quantita: 2,
    prezzo_unitario_cent: 15000,
    importo_cent: 30000,
    voce_listino_id: null,
    gruppo_alternativa_id: null,
    accettata: null, // nessuna decisione finché il cliente non risponde
  });
  expect(righe[1]).toMatchObject({ tipo: "canone_mensile", prezzo_unitario_cent: 2000 });
  const [p] = await sql`select imponibile_cent from preventivi where oggetto = ${OGGETTO}`;
  expect(p.imponibile_cent).toBe(30000);
  // il dettaglio separa le due sezioni
  await expect(page.locator("#titolo-una-tantum")).toBeVisible();
  await expect(page.locator("#titolo-abbonamenti")).toBeVisible();
});

test("canone annuale e mensile dello stesso servizio si salvano come alternative, e non si sommano", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.locator("input[name=oggetto]").fill(`${OGGETTO} alternative`);
  await page.getByLabel("Descrizione prestazione 1").fill("Sito");
  await page.getByLabel("Prezzo prestazione 1").fill("1000");
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 1").fill("Manutenzione");
  await page.getByLabel("Periodicità abbonamento 1").selectOption("canone_annuo");
  await page.getByLabel("Prezzo abbonamento 1").fill("600");
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 2").fill("Manutenzione");
  await page.getByLabel("Periodicità abbonamento 2").selectOption("canone_mensile");
  await page.getByLabel("Prezzo abbonamento 2").fill("60");
  // un'alternativa deve avere periodicità diversa: l'altro annuale non è proponibile
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 3").fill("Hosting");
  await page.getByLabel("Periodicità abbonamento 3").selectOption("canone_annuo");
  await page.getByLabel("Prezzo abbonamento 3").fill("100");
  const scelta = page.getByLabel("Alternativa per abbonamento 2");
  await expect(scelta.locator("option", { hasText: "Hosting" })).toHaveCount(1); // annuale ≠ mensile
  await scelta.selectOption({ index: 1 }); // «Manutenzione (annuale)»
  await expect(
    page.getByText("Alternativa: il cliente sceglie una periodicità").first(),
  ).toBeVisible();
  // il riepilogo mostra «oppure» e non somma 600 + 60 × 12
  await expect(page.getByText("oppure").first()).toBeVisible();
  await expect(page.getByText("€ 1.320,00")).toHaveCount(0);
  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);

  const righe = await sql`
    select r.descrizione, r.tipo, r.gruppo_alternativa_id from preventivo_righe r
    join preventivi p on p.id = r.preventivo_id where p.oggetto = ${`${OGGETTO} alternative`} order by r.posizione`;
  expect(righe).toHaveLength(4);
  const manutenzione = righe.filter(
    (r: { descrizione: string }) => r.descrizione === "Manutenzione",
  );
  expect(manutenzione[0].gruppo_alternativa_id).not.toBeNull();
  expect(manutenzione[0].gruppo_alternativa_id).toBe(manutenzione[1].gruppo_alternativa_id);
  expect(
    righe.find((r: { descrizione: string }) => r.descrizione === "Hosting").gruppo_alternativa_id,
  ).toBeNull();
  // nel dettaglio le due alternative sono raggruppate
  await expect(page.locator("tbody[data-gruppo=alternative] tr")).toHaveCount(2);
});

test("una riga incompleta blocca il salvataggio", async ({ page }) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.getByLabel("Descrizione prestazione 1").fill("Senza prezzo");
  await expect(page.getByRole("button", { name: "Salva bozza" })).toBeDisabled();
  await page.getByLabel("Prezzo prestazione 1").fill("abc");
  await expect(page.getByRole("button", { name: "Salva bozza" })).toBeDisabled();
  await page.getByLabel("Prezzo prestazione 1").fill("10,5");
  await expect(page.getByRole("button", { name: "Salva bozza" })).toBeEnabled();
});

test("le righe del listino si mescolano con quelle libere", async ({ page }) => {
  const [voce] = await sql`
    select b.id, b.nome, b.una_tantum_cent from listino_basi b
    join listini l on l.id = b.listino_id
    where b.deleted_at is null and l.deleted_at is null and b.una_tantum_cent > 0
    order by b.created_at limit 1`;
  test.skip(!voce, "nessun listino con una base nel database di sviluppo");

  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.locator("input[name=oggetto]").fill(`${OGGETTO} listino`);
  await page.getByRole("button", { name: /Dal listino/ }).click();
  await page
    .getByRole("button", { name: `Aggiungi ${voce.nome}` })
    .first()
    .click();
  await expect(page.getByLabel("Descrizione prestazione 1")).toHaveValue(new RegExp(voce.nome));
  // la riga libera è l'ultima prestazione: una voce con più prezzi ne genera più d'una
  const dalListino = await page.getByLabel(/^Descrizione prestazione/).count();
  await page.getByRole("button", { name: /Aggiungi prestazione/ }).click();
  await page.getByLabel(`Descrizione prestazione ${dalListino + 1}`).fill("Extra a mano");
  await page.getByLabel(`Prezzo prestazione ${dalListino + 1}`).fill("50");
  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);
  const righe = await sql`
    select r.voce_listino_id from preventivo_righe r join preventivi p on p.id = r.preventivo_id
    where p.oggetto = ${`${OGGETTO} listino`} order by r.posizione`;
  expect(righe[0].voce_listino_id).toBe(voce.id);
  expect(righe.at(-1).voce_listino_id).toBeNull();
});

test("una voce di listino con canone annuale e mensile entra come alternativa", async ({
  page,
}) => {
  const [rs] =
    await sql`select id from ragioni_sociali where deleted_at is null order by created_at limit 1`;
  const [l] =
    await sql`insert into listini (ragione_sociale_id, nome) values (${rs.id}, 'E2E listino alternative') returning id`;
  try {
    await sql`insert into listino_basi (listino_id, nome, canone_annuo_cent, canone_mensile_cent)
              values (${l.id}, 'E2E Manutenzione sito', 60000, 6000)`;
    await accedi(page);
    await page.goto("/preventivi/nuovo");
    await page.locator("input[name=oggetto]").fill(`${OGGETTO} voce doppia`);
    await page.getByRole("button", { name: /Dal listino/ }).click();
    // con più listini si parte dal primo: scegliamo quello di prova
    const scelta = page.getByLabel("Listino", { exact: true });
    if (await scelta.count())
      await scelta.selectOption({ label: "Listino E2E listino alternative" });
    const voce = page.getByRole("button", { name: "Aggiungi E2E Manutenzione sito" });
    await voce.first().click();
    // due righe, nella sezione abbonamenti, già alternative tra loro
    await expect(page.locator("li[data-gruppo]")).toHaveCount(2);
    await expect(page.getByText("oppure").first()).toBeVisible();
    await page.getByRole("button", { name: "Salva bozza" }).click();
    await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);
    const righe = await sql`
      select r.tipo, r.gruppo_alternativa_id from preventivo_righe r join preventivi p on p.id = r.preventivo_id
      where p.oggetto = ${`${OGGETTO} voce doppia`}`;
    expect(righe).toHaveLength(2);
    expect(righe[0].gruppo_alternativa_id).not.toBeNull();
    expect(righe[0].gruppo_alternativa_id).toBe(righe[1].gruppo_alternativa_id);
    expect(new Set(righe.map((r: { tipo: string }) => r.tipo))).toEqual(
      new Set(["canone_annuo", "canone_mensile"]),
    );
  } finally {
    await sql`delete from listino_basi where listino_id = ${l.id}`;
    await sql`delete from listini where id = ${l.id}`;
  }
});
