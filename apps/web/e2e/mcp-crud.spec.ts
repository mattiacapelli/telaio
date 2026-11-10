import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
  test,
} from "@playwright/test";
import Redis from "ioredis";
import { cifra } from "../lib/archivio/segreti";

// Gira sul database di sviluppo e sul MinIO di docker-compose, come le altre suite.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const CHIAVE = "tlk_e2e-mcp-crud-chiave-di-prova";
const CHIAVE_LETTURA = "tlk_e2e-mcp-crud-sola-lettura";
const NOME = "E2E MCP";
const BUCKET = "telaio-e2e";
const PREFISSO = "e2e-mcp";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let api: APIRequestContext;
let apiLettura: APIRequestContext;
let precedenti: Record<string, unknown> = {};
let nomiStrumenti: string[] = [];

const hash = (k: string) => createHash("sha256").update(k).digest("hex");

async function rpc(ctx: APIRequestContext, metodo: string, params: unknown = {}) {
  const r = await ctx.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 1, method: metodo, params },
  });
  expect(r.status(), `${metodo}: ${await r.text()}`).toBe(200);
  return (await r.json()).result;
}

/** Chiama uno strumento e ritorna il JSON del risultato; fallisce se lo strumento dà errore. */
async function ok<T = Record<string, any>>(
  nome: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const r = await rpc(api, "tools/call", { name: nome, arguments: args });
  const testo = r.content?.[0]?.text as string;
  expect(r.isError, `${nome}: ${testo}`).toBeFalsy();
  return JSON.parse(testo) as T;
}

/** Chiama uno strumento che deve dare errore e ritorna il messaggio. */
async function ko(nome: string, args: Record<string, unknown> = {}): Promise<string> {
  const r = await rpc(api, "tools/call", { name: nome, arguments: args });
  expect(r.isError, `${nome} doveva fallire`).toBe(true);
  return r.content?.[0]?.text as string;
}

async function pulisci() {
  const rs = await sql`select id from ragioni_sociali where nome like ${`${NOME}%`}`;
  const rsIds = rs.map((r: { id: string }) => r.id);
  const prj = await sql`select id from progetti where nome like ${`${NOME}%`}`;
  const prjIds = prj.map((r: { id: string }) => r.id);
  if (prjIds.length) {
    await sql`delete from progetto_documenti where progetto_id in ${sql(prjIds)}`;
    await sql`delete from ticket where progetto_id in ${sql(prjIds)}`;
    await sql`delete from progetto_risorse where progetto_id in ${sql(prjIds)}`;
    await sql`delete from progetti where id in ${sql(prjIds)}`;
  }
  if (rsIds.length) {
    await sql`delete from solleciti where rata_id in (select id from rate where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from movimenti where incasso_id in (select id from incassi where ragione_sociale_id in ${sql(rsIds)}) or conto_id in (select id from conti where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from incassi where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`update fatture set rata_id = null where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from rate where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from abbonamenti where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from fattura_righe where fattura_id in (select id from fatture where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from fatture where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from preventivo_righe where preventivo_id in (select id from preventivi where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from preventivi where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from modulo_basi where modulo_id in (select id from listino_moduli where listino_id in (select id from listini where ragione_sociale_id in ${sql(rsIds)}))`;
    await sql`delete from listino_moduli where listino_id in (select id from listini where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from listino_basi where listino_id in (select id from listini where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from listini where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`update ragioni_sociali set conto_predefinito_id = null where id in ${sql(rsIds)}`;
    await sql`delete from movimenti where conto_id in (select id from conti where ragione_sociale_id in ${sql(rsIds)})`;
    await sql`delete from conti where ragione_sociale_id in ${sql(rsIds)}`;
    await sql`delete from numerazioni where ragione_sociale_id in ${sql(rsIds)}`.catch(() => {});
    await sql`delete from ragioni_sociali where id in ${sql(rsIds)}`;
  }
  await sql`delete from conti where nome like ${`${NOME}%`}`;
  await sql`delete from clienti_ref where nome like ${`${NOME}%`}`;
  await sql`delete from pending_actions where api_key_id in (select id from api_keys where nome like ${`${NOME}%`})`;
  await sql`delete from audit_log where api_key_id in (select id from api_keys where nome like ${`${NOME}%`})`;
  await sql`delete from api_keys where nome like ${`${NOME}%`}`;
}

test.beforeAll(async ({ playwright }) => {
  await pulisci();
  for (const chiave of ["mcp.strumenti", "mcp.approvazione", "archivio.s3", "ticket", "email"]) {
    const [r] = await sql`select valore from impostazioni where chiave = ${chiave}`;
    precedenti[chiave] = r?.valore ?? null;
    await sql`delete from impostazioni where chiave = ${chiave}`;
  }
  await sql`insert into api_keys (nome, prefisso, hash, permessi, scopes) values (${`${NOME} scrittura`}, 'tlk_e2e', ${hash(CHIAVE)}, 'lettura_scrittura', ${["mcp"]})`;
  await sql`insert into api_keys (nome, prefisso, hash, permessi, scopes) values (${`${NOME} lettura`}, 'tlk_e2e', ${hash(CHIAVE_LETTURA)}, 'lettura', ${["mcp"]})`;
  const base = { baseURL: "http://localhost:3000" };
  api = await playwright.request.newContext({
    ...base,
    extraHTTPHeaders: { authorization: `Bearer ${CHIAVE}` },
  });
  apiLettura = await playwright.request.newContext({
    ...base,
    extraHTTPHeaders: { authorization: `Bearer ${CHIAVE_LETTURA}` },
  });

  // archivio S3 di prova (MinIO di sviluppo): bucket e chiavi cifrate come le salverebbe l'app
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:9100",
    forcePathStyle: true,
    credentials: { accessKeyId: "telaio", secretAccessKey: "telaio-dev-2026" },
  });
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET })).catch(() => {});
  await sql`insert into impostazioni (chiave, valore) values ('archivio.s3', ${sql.json({
    endpoint: "http://localhost:9100",
    region: "us-east-1",
    bucket: BUCKET,
    prefisso: `${PREFISSO}/`,
    pathStyle: true,
    accessKeyId: "telaio",
    secretCifrato: cifra("telaio-dev-2026"),
  })}) on conflict (chiave) do update set valore = excluded.valore`;
});

// Il limite è di 120 richieste al minuto per chiave: la suite ne fa di più, quindi lo si azzera a ogni prova.
test.beforeEach(async () => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6380");
  const chiavi = await sql`select id from api_keys where nome like ${`${NOME}%`}`;
  for (const { id } of chiavi) {
    const k = await redis.keys(`rl:${id}:*`);
    if (k.length) await redis.del(...k);
  }
  redis.disconnect();
});

test.afterAll(async () => {
  await api?.dispose();
  await apiLettura?.dispose();
  await pulisci();
  for (const chiave of ["mcp.strumenti", "mcp.approvazione", "archivio.s3", "ticket", "email"]) {
    await sql`delete from impostazioni where chiave = ${chiave}`;
    if (precedenti[chiave])
      await sql`insert into impostazioni (chiave, valore) values (${chiave}, ${sql.json(precedenti[chiave] as object)})`;
  }
  await sql.end();
});

test("l'elenco degli strumenti comprende il CRUD di ogni entità; la chiave di sola lettura non vede le scritture", async () => {
  const { tools } = await rpc(api, "tools/list");
  nomiStrumenti = tools.map((t: { name: string }) => t.name);
  const attesi = [
    // anagrafiche
    "crea_ragione_sociale",
    "modifica_ragione_sociale",
    "elimina_ragione_sociale",
    "dettaglio_ragione_sociale",
    "modifica_regole_fiscali",
    "crea_conto",
    "modifica_conto",
    "elimina_conto",
    "dettaglio_conto",
    "crea_listino",
    "modifica_listino",
    "elimina_listino",
    "dettaglio_listino",
    "crea_base_listino",
    "modifica_base_listino",
    "elimina_base_listino",
    "crea_modulo_listino",
    "modifica_modulo_listino",
    "elimina_modulo_listino",
    // commerciale e contabilità
    "crea_preventivo_libero",
    "modifica_preventivo_bozza",
    "elimina_preventivo_bozza",
    "accetta_preventivo",
    "modifica_fattura_bozza",
    "elimina_fattura_bozza",
    "modifica_date_fattura",
    "modifica_incasso",
    "elimina_incasso",
    "dettaglio_incasso",
    "modifica_movimento",
    "elimina_movimento",
    "dettaglio_movimento",
    "modifica_abbonamento",
    "elimina_abbonamento",
    "modifica_rata",
    "annulla_rata",
    "dettaglio_rata",
    // progetti, ticket, documenti
    "elenca_progetti",
    "dettaglio_progetto",
    "crea_progetto",
    "modifica_progetto",
    "cambia_stato_progetto",
    "aggiungi_risorsa_progetto",
    "modifica_risorsa_progetto",
    "elimina_risorsa_progetto",
    "elenca_ticket",
    "dettaglio_ticket",
    "crea_ticket",
    "modifica_ticket",
    "sposta_ticket",
    "elimina_ticket",
    "commenta_ticket",
    "elimina_commento_ticket",
    "elenca_documenti_progetto",
    "carica_documento",
    "scarica_documento",
    "modifica_documento",
    "elimina_documento",
    // già presenti
    "elenca_preventivi",
    "crea_fattura_libera",
    "registra_incasso",
    "crea_abbonamento",
    "registra_movimento",
  ];
  for (const n of attesi) expect(nomiStrumenti, n).toContain(n);
  // ogni strumento ha uno schema dei parametri valido
  for (const t of tools) expect(t.inputSchema?.type, t.name).toBe("object");

  const lettura = await rpc(apiLettura, "tools/list");
  const nomiLettura = lettura.tools.map((t: { name: string }) => t.name);
  expect(nomiLettura).toContain("elenca_ticket");
  expect(nomiLettura).not.toContain("crea_ticket");
  expect(nomiLettura).not.toContain("elimina_documento");
});

test("di default le scritture aspettano la conferma: l'azione resta in attesa e non esegue", async () => {
  const r = await ok<{ stato: string; pendingActionId: string }>("crea_ragione_sociale", {
    nome: `${NOME} in attesa`,
  });
  expect(r.stato).toBe("in_attesa_di_conferma");
  expect(
    (await sql`select count(*)::int n from ragioni_sociali where nome = ${`${NOME} in attesa`}`)[0]
      .n,
  ).toBe(0);
  expect(
    (await sql`select stato from pending_actions where id = ${r.pendingActionId}`)[0].stato,
  ).toBe("in_attesa");
  // da qui le scritture girano subito: si toglie la conferma a tutti gli strumenti
  const senza = Object.fromEntries(nomiStrumenti.map((n) => [n, false]));
  await sql`insert into impostazioni (chiave, valore) values ('mcp.approvazione', ${sql.json(senza)})`;
  await sql`delete from pending_actions where id = ${r.pendingActionId}`;
});

test("ragioni sociali, regole fiscali, conti e listini: crea, leggi, modifica, elimina", async () => {
  const { id } = await ok("crea_ragione_sociale", {
    nome: `${NOME} RS`,
    tipo: "srl",
    citta: "Roma",
    formatoFattura: "FT-{AAAA}-{NNN}",
  });
  const d = await ok("dettaglio_ragione_sociale", { id });
  expect(d).toMatchObject({
    nome: `${NOME} RS`,
    tipo: "srl",
    citta: "Roma",
    formatoFattura: "FT-{AAAA}-{NNN}",
    formatoPreventivo: "P-{AAAA}-{NNN}",
  });

  // una modifica parziale non riscrive il resto (niente default applicati per sbaglio)
  await ok("modifica_ragione_sociale", { id, provincia: "RM" });
  expect(await ok("dettaglio_ragione_sociale", { id })).toMatchObject({
    provincia: "RM",
    tipo: "srl",
    citta: "Roma",
    formatoFattura: "FT-{AAAA}-{NNN}",
  });
  await ok("modifica_ragione_sociale", { id, citta: null });
  expect((await ok("dettaglio_ragione_sociale", { id })).citta).toBeNull();
  expect(await ko("modifica_ragione_sociale", { id, formatoFattura: "senza-token" })).toContain(
    "token",
  );
  expect(await ko("modifica_ragione_sociale", { id })).toContain("Nessun campo");

  // regole fiscali: senza IVA servono natura e dicitura
  expect(await ko("modifica_regole_fiscali", { id, ivaAttiva: false })).toContain("natura");
  await ok("modifica_regole_fiscali", {
    id,
    ivaAttiva: false,
    naturaSenzaIva: "N2.2",
    diciturSenzaIva: "Regime forfettario",
    bolloAutomatico: true,
  });
  expect(await ok("dettaglio_ragione_sociale", { id })).toMatchObject({
    ivaAttiva: false,
    naturaSenzaIva: "N2.2",
    bolloAutomatico: true,
  });
  await ok("modifica_regole_fiscali", {
    id,
    ivaAttiva: true,
    aliquotaIvaBp: 2200,
    ritenutaBp: 2000,
  });
  expect(await ok("dettaglio_ragione_sociale", { id })).toMatchObject({
    ivaAttiva: true,
    naturaSenzaIva: null,
    bolloAutomatico: false,
    ritenutaBp: 2000,
  });

  // conti
  await ok("crea_conto", {
    nome: `${NOME} conto`,
    tipo: "bonifico",
    ragioneSocialeId: id,
    saldoInizialeCent: 100000,
  });
  const [{ id: contoId }] = await sql`select id from conti where nome = ${`${NOME} conto`}`;
  expect(await ok("dettaglio_conto", { id: contoId })).toMatchObject({
    nome: `${NOME} conto`,
    saldoCent: 100000,
  });
  await ok("modifica_conto", {
    id: contoId,
    nome: `${NOME} conto rinominato`,
    iban: "IT60X0542811101000000123456",
  });
  expect(await ok("dettaglio_conto", { id: contoId })).toMatchObject({
    nome: `${NOME} conto rinominato`,
    tipo: "bonifico",
    iban: "IT60X0542811101000000123456",
  });

  // listino, basi e moduli
  const { id: listinoId } = await ok("crea_listino", {
    ragioneSocialeId: id,
    nome: `${NOME} listino`,
  });
  const { id: baseA } = await ok("crea_base_listino", {
    listinoId,
    nome: "Base A",
    unaTantumCent: 100000,
    canoneMensileCent: 1000,
  });
  const { id: baseB } = await ok("crea_base_listino", {
    listinoId,
    nome: "Base B",
    unaTantumCent: 200000,
  });
  const { id: moduloId } = await ok("crea_modulo_listino", {
    listinoId,
    nome: "Modulo X",
    canoneAnnuoCent: 5000,
    baseIds: [baseA],
  });
  let l = await ok("dettaglio_listino", { id: listinoId });
  expect(l.basi).toHaveLength(2);
  expect(l.moduli[0]).toMatchObject({ nome: "Modulo X", canoneAnnuoCent: 5000, baseIds: [baseA] });
  await ok("modifica_modulo_listino", { id: moduloId, baseIds: [baseA, baseB], nome: "Modulo X2" });
  l = await ok("dettaglio_listino", { id: listinoId });
  expect(l.moduli[0].nome).toBe("Modulo X2");
  expect([...l.moduli[0].baseIds].sort()).toEqual([baseA, baseB].sort());
  expect(l.moduli[0].canoneAnnuoCent).toBe(5000);
  await ok("modifica_base_listino", { id: baseA, unaTantumCent: 150000 });
  expect(
    (await ok("dettaglio_listino", { id: listinoId })).basi.find(
      (b: { id: string }) => b.id === baseA,
    ).unaTantumCent,
  ).toBe(150000);
  expect(
    await ko("modifica_modulo_listino", {
      id: moduloId,
      baseIds: ["00000000-0000-4000-8000-000000000000"],
    }),
  ).toContain("basi");
  await ok("elimina_base_listino", { id: baseB });
  await ok("elimina_modulo_listino", { id: moduloId });
  expect((await ok("dettaglio_listino", { id: listinoId })).moduli).toHaveLength(0);
  await ok("elimina_listino", { id: listinoId });
  expect(await ko("dettaglio_listino", { id: listinoId })).toContain("non trovato");

  // impostazioni delle email
  await ok("imposta_firma_email", { firma: "— E2E MCP" });
  await ok("imposta_mittente_email", {
    ragioneSocialeId: id,
    nome: "Studio E2E",
    email: "studio@e2e.example.com",
  });
  const em = await ok("leggi_impostazioni_email");
  expect(em.firma).toBe("— E2E MCP");
  expect(em.mittenti[id]).toMatchObject({ nome: "Studio E2E", email: "studio@e2e.example.com" });
  expect(
    await ko("imposta_mittente_email", { ragioneSocialeId: id, email: "non-valida" }),
  ).toBeTruthy();

  await sql`update ragioni_sociali set nome = ${`${NOME} RS`} where id = ${id}`;
});

test("preventivi, fatture, incassi, prima nota, abbonamenti e rate", async () => {
  const [{ id: rsId }] = await sql`select id from ragioni_sociali where nome = ${`${NOME} RS`}`;
  const [{ id: contoId }] =
    await sql`select id from conti where nome = ${`${NOME} conto rinominato`}`;
  const [{ id: clienteId }] =
    await sql`insert into clienti_ref (nome) values (${`${NOME} cliente`}) returning id`;

  // preventivo: crea, modifica la bozza, elimina una seconda bozza
  const righe = [
    { descrizione: "Sito", tipo: "una_tantum", quantita: 1, prezzoUnitarioCent: 100000 },
    {
      descrizione: "Hosting — canone mensile",
      tipo: "canone_mensile",
      quantita: 1,
      prezzoUnitarioCent: 1000,
    },
  ];
  const { id: prevId } = await ok("crea_preventivo_libero", {
    ragioneSocialeId: rsId,
    oggetto: `${NOME} preventivo`,
    righe,
  });
  await ok("modifica_preventivo_bozza", {
    id: prevId,
    ragioneSocialeId: rsId,
    oggetto: `${NOME} preventivo rivisto`,
    righe: [{ ...righe[0], prezzoUnitarioCent: 120000 }, righe[1]],
  });
  let p = await ok("dettaglio_preventivo", { id: prevId });
  expect(p.preventivo).toMatchObject({
    oggetto: `${NOME} preventivo rivisto`,
    imponibileCent: 120000,
    stato: "bozza",
  });
  expect(p.righe).toHaveLength(2);
  const { id: bozza2 } = await ok("crea_preventivo_libero", {
    ragioneSocialeId: rsId,
    oggetto: `${NOME} da eliminare`,
    righe: [righe[0]],
  });
  // data passata: l'anno e la scadenza la seguono; in bozza la data si cambia con modifica_preventivo_bozza
  const annoPassato = new Date().getFullYear() - 1;
  expect((await ok("dettaglio_preventivo", { id: bozza2 })).preventivo.dataPreventivo).toBe(
    new Date().toISOString().slice(0, 10),
  );
  const { id: bozzaPassata } = await ok("crea_preventivo_libero", {
    ragioneSocialeId: rsId,
    oggetto: `${NOME} datato`,
    data: `${annoPassato}-05-10`,
    validitaGiorni: 30,
    righe: [righe[0]],
  });
  expect((await ok("dettaglio_preventivo", { id: bozzaPassata })).preventivo).toMatchObject({
    dataPreventivo: `${annoPassato}-05-10`,
    anno: annoPassato,
    validoFino: `${annoPassato}-06-09`,
  });
  expect(
    await ko("modifica_data_preventivo", { id: bozzaPassata, data: `${annoPassato}-05-11` }),
  ).toContain("bozza");
  expect(
    await ko("crea_preventivo_libero", {
      ragioneSocialeId: rsId,
      righe: [righe[0]],
      data: "2026-02-31",
    }),
  ).toBeTruthy();
  await ok("elimina_preventivo_bozza", { id: bozzaPassata });
  await ok("elimina_preventivo_bozza", { id: bozza2 });
  expect(await ko("dettaglio_preventivo", { id: bozza2 })).toContain("non trovato");

  // invio e accettazione parziale (solo la prestazione una tantum): non si modifica più
  await sql`update preventivi set cliente_ref_id = ${clienteId} where id = ${prevId}`;
  await ok("cambia_stato_preventivo", { id: prevId, stato: "inviato" });
  // dopo l'invio la data si sposta solo dentro l'anno del numero
  const annoNumero = (await ok("dettaglio_preventivo", { id: prevId })).preventivo.anno;
  await ok("modifica_data_preventivo", { id: prevId, data: `${annoNumero}-01-05` });
  expect((await ok("dettaglio_preventivo", { id: prevId })).preventivo.dataPreventivo).toBe(
    `${annoNumero}-01-05`,
  );
  expect(
    await ko("modifica_data_preventivo", { id: prevId, data: `${annoNumero - 1}-12-31` }),
  ).toContain(`${annoNumero}`);
  expect(
    await ko("modifica_preventivo_bozza", { id: prevId, ragioneSocialeId: rsId, righe }),
  ).toContain("bozza");
  expect(await ko("elimina_preventivo_bozza", { id: prevId })).toContain("bozza");
  p = await ok("dettaglio_preventivo", { id: prevId });
  const rigaUnaTantum = p.righe.find((r: { tipo: string }) => r.tipo === "una_tantum");
  const esito = await ok("accetta_preventivo", {
    id: prevId,
    scelta: { righe: [rigaUnaTantum.id], gruppi: {} },
  });
  expect(esito.stato).toBe("accettato_parzialmente");

  // fattura: bozza libera, modifica, elimina una seconda, emissione, date
  const { id: fatId } = await ok("crea_fattura_libera", {
    ragioneSocialeId: rsId,
    clienteRefId: clienteId,
    righe: [{ descrizione: "Lavoro", quantita: 1, prezzoUnitarioCent: 50000, scontoBp: 0 }],
  });
  await ok("modifica_fattura_bozza", {
    id: fatId,
    note: "Nota E2E",
    righe: [{ descrizione: "Lavoro rivisto", quantita: 2, prezzoUnitarioCent: 50000, scontoBp: 0 }],
  });
  let f = await ok("dettaglio_fattura", { id: fatId });
  expect(f.fattura).toMatchObject({ note: "Nota E2E", imponibileCent: 100000 });
  expect(f.righe).toHaveLength(1);
  const { id: fatBozza2 } = await ok("crea_fattura_libera", {
    ragioneSocialeId: rsId,
    clienteRefId: clienteId,
    righe: [{ descrizione: "Da eliminare", quantita: 1, prezzoUnitarioCent: 100, scontoBp: 0 }],
  });
  await ok("elimina_fattura_bozza", { id: fatBozza2 });
  expect(await ko("dettaglio_fattura", { id: fatBozza2 })).toContain("non trovata");

  await ok("emetti_fattura", { fatturaId: fatId });
  expect(await ko("modifica_fattura_bozza", { id: fatId, note: "x" })).toContain("bozza");
  expect(await ko("elimina_fattura_bozza", { id: fatId })).toContain("bozza");
  f = await ok("dettaglio_fattura", { id: fatId });
  const anno = f.fattura.anno;
  await ok("modifica_date_fattura", {
    id: fatId,
    dataEmissione: `${anno}-01-15`,
    scadenza: `${anno}-12-31`,
  });
  expect(
    (
      await sql`select data_emissione::text e, scadenza::text s from fatture where id = ${fatId}`
    )[0],
  ).toEqual({ e: `${anno}-01-15`, s: `${anno}-12-31` });
  expect(
    await ko("modifica_date_fattura", {
      id: fatId,
      dataEmissione: `${anno - 1}-12-31`,
      scadenza: `${anno}-12-31`,
    }),
  ).toContain(`${anno}`);

  // incasso: registra, modifica (data, importo), elimina; lo stato di rata e fattura segue
  await ok("registra_incasso", {
    contoId,
    fatturaId: fatId,
    importoCent: 40000,
    data: `${anno}-02-01`,
    descrizione: "Acconto",
  });
  const { incassi } = await ok("dettaglio_fattura", { id: fatId });
  const incassoId = incassi[0].id;
  expect((await sql`select stato from fatture where id = ${fatId}`)[0].stato).toBe(
    "parzialmente_pagata",
  );
  await ok("modifica_incasso", {
    id: incassoId,
    data: `${anno}-02-10`,
    importoCent: 122000,
    descrizione: "Saldo",
  });
  expect(await ok("dettaglio_incasso", { id: incassoId })).toMatchObject({
    data: `${anno}-02-10`,
    importoCent: 122000,
    descrizione: "Saldo",
  });
  expect((await sql`select stato from fatture where id = ${fatId}`)[0].stato).toBe("pagata");
  const mov =
    await sql`select data::text d, importo_cent, descrizione from movimenti where incasso_id = ${incassoId} and deleted_at is null`;
  expect(mov).toHaveLength(1);
  expect(mov[0]).toMatchObject({ d: `${anno}-02-10`, importo_cent: 122000, descrizione: "Saldo" });
  // il movimento nato da un incasso non si tocca da solo
  const [{ id: movDaIncasso }] =
    await sql`select id from movimenti where incasso_id = ${incassoId}`;
  expect(await ko("modifica_movimento", { id: movDaIncasso, importoCent: 1 })).toContain("incasso");
  expect(await ko("elimina_movimento", { id: movDaIncasso })).toContain("incasso");
  await ok("elimina_incasso", { id: incassoId });
  expect((await sql`select stato from fatture where id = ${fatId}`)[0].stato).toBe("emessa");
  expect(
    (
      await sql`select count(*)::int n from movimenti where incasso_id = ${incassoId} and deleted_at is null`
    )[0].n,
  ).toBe(0);
  expect(await ko("dettaglio_incasso", { id: incassoId })).toContain("non trovato");

  // prima nota: registra a mano, modifica, elimina
  await ok("registra_movimento", {
    tipo: "uscita",
    data: `${anno}-03-01`,
    importoCent: 5000,
    contoId,
    categoria: "E2E MCP",
    descrizione: "Spesa",
  });
  const [{ id: movId }] =
    await sql`select id from movimenti where categoria = 'E2E MCP' and deleted_at is null`;
  await ok("modifica_movimento", { id: movId, importoCent: 7000, descrizione: "Spesa rivista" });
  expect(await ok("dettaglio_movimento", { id: movId })).toMatchObject({
    tipo: "uscita",
    importoCent: 7000,
    descrizione: "Spesa rivista",
    categoria: "E2E MCP",
  });
  expect(await ko("modifica_movimento", { id: movId, tipo: "giroconto" })).toContain(
    "destinazione",
  );
  await ok("elimina_movimento", { id: movId });
  expect(await ko("dettaglio_movimento", { id: movId })).toContain("non trovato");

  // abbonamento e rate
  const inizio = `${anno}-01-01`;
  const ab = await ok("crea_abbonamento", {
    ragioneSocialeId: rsId,
    clienteRefId: clienteId,
    descrizione: "Hosting E2E",
    periodicita: "mensile",
    importoRataCent: 1000,
    inizio,
  });
  await ok("modifica_abbonamento", {
    id: ab.id,
    descrizione: "Hosting E2E rivisto",
    importoRataCent: 1500,
  });
  const dett = await ok("dettaglio_abbonamento", { id: ab.id });
  expect(dett.abbonamento).toMatchObject({
    descrizione: "Hosting E2E rivisto",
    importoRataCent: 1500,
  });
  const futura = dett.rate.find(
    (r: { scadenza: string; stato: string }) =>
      r.stato === "da_incassare" && r.scadenza > new Date().toISOString().slice(0, 10),
  );
  expect(futura?.importoCent).toBe(1500);
  expect(await ko("modifica_abbonamento", { id: ab.id, fine: `${anno - 1}-01-01` })).toContain(
    "inizio",
  );
  // una rata dell'abbonamento si sposta e si annulla; quella di una fattura no
  await ok("modifica_rata", { id: futura.id, descrizione: "Rata rivista" });
  expect((await ok("dettaglio_rata", { id: futura.id })).rata.descrizione).toBe("Rata rivista");
  await ok("annulla_rata", { id: futura.id });
  expect((await ok("dettaglio_rata", { id: futura.id })).rata.stato).toBe("annullata");
  expect(await ko("annulla_rata", { id: futura.id })).toContain("già annullata");
  const [{ id: rataFattura }] = await sql`select id from rate where fattura_id = ${fatId}`;
  expect(await ko("modifica_rata", { id: rataFattura, scadenza: `${anno}-06-01` })).toContain(
    "fattura",
  );
  expect(await ko("annulla_rata", { id: rataFattura })).toContain("fattura");
  await ok("elimina_abbonamento", { id: ab.id });
  expect(await ko("dettaglio_abbonamento", { id: ab.id })).toContain("non trovato");
  expect(
    (
      await sql`select count(*)::int n from rate where abbonamento_id = ${ab.id} and stato = 'da_incassare' and scadenza > current_date`
    )[0].n,
  ).toBe(0);

  // il registro delle operazioni è leggibile
  const audit = await ok<unknown[]>("elenca_audit", { limite: 5 });
  expect(Array.isArray(audit)).toBe(true);
});

test("progetti, risorse, ticket, commenti e impostazioni dei ticket", async () => {
  const { id } = await ok("crea_progetto", {
    nome: `${NOME} progetto`,
    categoria: "sito_web",
    priorita: "alta",
    dataInizioPrevista: "2026-12-01",
  });
  const prj = await ok("dettaglio_progetto", { id });
  expect(prj.progetto).toMatchObject({
    nome: `${NOME} progetto`,
    categoria: "sito_web",
    priorita: "alta",
    stato: "pianificato",
  });
  expect(prj.progetto.codice).toMatch(/^PRJ-/);

  // modifica parziale: il resto non cambia
  await ok("modifica_progetto", { id, descrizione: "Descrizione E2E" });
  expect((await ok("dettaglio_progetto", { id })).progetto).toMatchObject({
    descrizione: "Descrizione E2E",
    categoria: "sito_web",
    priorita: "alta",
    dataInizioPrevista: "2026-12-01",
  });
  expect(
    await ko("modifica_progetto", {
      id,
      dataInizioPrevista: "2026-12-10",
      dataFinePrevista: "2026-12-01",
    }),
  ).toContain("fine");
  await ok("cambia_stato_progetto", { id, stato: "in_corso" });
  const dopo = (await ok("dettaglio_progetto", { id })).progetto;
  expect(dopo.stato).toBe("in_corso");
  expect(dopo.dataInizioEffettiva).not.toBeNull();
  expect(
    (await ok<{ id: string }[]>("elenca_progetti", { testo: NOME })).map((x) => x.id),
  ).toContain(id);

  // risorse
  const { id: risId } = await ok("aggiungi_risorsa_progetto", {
    progettoId: id,
    tipo: "repository",
    titolo: "Repo",
    url: "https://github.com/e2e/repo",
    principale: true,
  });
  expect(
    await ko("aggiungi_risorsa_progetto", {
      progettoId: id,
      tipo: "other",
      titolo: "Brutta",
      url: "https://utente:pw@host.it",
    }),
  ).toBeTruthy();
  await ok("modifica_risorsa_progetto", { id: risId, titolo: "Repo principale" });
  expect((await ok("dettaglio_progetto", { id })).risorse[0]).toMatchObject({
    titolo: "Repo principale",
    url: "https://github.com/e2e/repo",
    tipo: "repository",
    principale: true,
  });
  await ok("elimina_risorsa_progetto", { id: risId });
  expect((await ok("dettaglio_progetto", { id })).risorse).toHaveLength(0);

  // ticket
  const t1 = await ok("crea_ticket", {
    progettoId: id,
    titolo: "Primo",
    tipo: "bug",
    priorita: "urgente",
  });
  const t2 = await ok("crea_ticket", { progettoId: id, titolo: "Secondo" });
  expect([t1.numero, t2.numero]).toEqual([1, 2]);
  await ok("modifica_ticket", { id: t2.id, descrizione: "Dettaglio", scadenza: "2026-12-31" });
  expect((await ok("dettaglio_ticket", { id: t2.id })).ticket).toMatchObject({
    titolo: "Secondo",
    descrizione: "Dettaglio",
    scadenza: "2026-12-31",
    stato: "da_fare",
    tipo: "attivita",
  });
  await ok("sposta_ticket", { id: t2.id, stato: "in_corso" });
  await ok("sposta_ticket", { id: t1.id, stato: "in_corso", primaDiTicketId: t2.id });
  const colonna = (
    await ok<{ stato: string; titolo: string }[]>("elenca_ticket", {
      progettoId: id,
      stato: "in_corso",
    })
  ).map((x) => x.titolo);
  expect(colonna).toEqual(["Primo", "Secondo"]);
  expect(
    (await ok<unknown[]>("elenca_ticket", { priorita: "urgente", testo: "Primo" })).length,
  ).toBeGreaterThanOrEqual(1);

  const c = await ok("commenta_ticket", { ticketId: t1.id, testo: "Riprodotto" });
  expect((await ok("dettaglio_ticket", { id: t1.id })).commenti).toHaveLength(1);
  await ok("elimina_commento_ticket", { id: c.id });
  expect((await ok("dettaglio_ticket", { id: t1.id })).commenti).toHaveLength(0);

  // impostazioni dei ticket
  expect(await ok("leggi_impostazioni_ticket")).toEqual({ autoAssegna: false });
  await ok("imposta_impostazioni_ticket", { autoAssegna: true });
  expect(await ok("leggi_impostazioni_ticket")).toEqual({ autoAssegna: true });

  // documenti: carica, elenca, scarica uguale, modifica (anche il ticket), elimina
  const contenuto = Buffer.from("Contratto E2E\nriga due\n");
  const doc = await ok("carica_documento", {
    progettoId: id,
    nome: "../contratto è.txt",
    contenutoBase64: contenuto.toString("base64"),
    tipoMime: "text/plain",
    categoria: "contratto",
    descrizione: "Firmato",
  });
  expect(doc.nome).toBe("contratto è.txt");
  const [riga] = await sql`select chiave from progetto_documenti where id = ${doc.id}`;
  expect(riga.chiave).toBe(`${PREFISSO}/progetti/${id}/${doc.id}/contratto è.txt`);
  expect(
    (await ok<{ id: string }[]>("elenca_documenti_progetto", { progettoId: id })).map((x) => x.id),
  ).toEqual([doc.id]);
  const scaricato = await ok("scarica_documento", { id: doc.id });
  expect(Buffer.from(scaricato.contenutoBase64, "base64")).toEqual(contenuto);
  expect(scaricato).toMatchObject({ nome: "contratto è.txt", tipoMime: "text/plain" });
  await ok("modifica_documento", { id: doc.id, categoria: "design", ticketId: t1.id });
  expect(
    await ok<{ ticketId: string; categoria: string }[]>("elenca_documenti_progetto", {
      progettoId: id,
      ticketId: t1.id,
    }),
  ).toHaveLength(1);
  expect((await ok("dettaglio_ticket", { id: t1.id })).documenti).toHaveLength(1);
  await ok("modifica_documento", { id: doc.id, ticketId: null });
  expect(
    await ok<unknown[]>("elenca_documenti_progetto", { progettoId: id, ticketId: t1.id }),
  ).toHaveLength(0);
  expect(
    await ko("carica_documento", { progettoId: id, nome: "vuoto.txt", contenutoBase64: "!!!" }),
  ).toBeTruthy();
  await ok("elimina_documento", { id: doc.id });
  expect(await ok<unknown[]>("elenca_documenti_progetto", { progettoId: id })).toHaveLength(0);

  // eliminazione dei ticket: esce dalla lavagna
  await ok("elimina_ticket", { id: t1.id });
  expect(await ko("dettaglio_ticket", { id: t1.id })).toContain("non trovato");
  expect((await ok<unknown[]>("elenca_ticket", { progettoId: id })).length).toBe(1);
  // un progetto non si cancella: si annulla
  await ok("cambia_stato_progetto", { id, stato: "annullato" });
  expect((await ok("dettaglio_progetto", { id })).progetto.stato).toBe("annullato");
});

test("un client MCP senza chiave o con chiave sbagliata non entra", async () => {
  const anonimo = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });
  const senza = await anonimo.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    maxRedirects: 0,
  });
  expect(senza.status()).toBe(401);
  const sbagliata = await anonimo.post("/mcp", {
    headers: {
      authorization: "Bearer tlk_sbagliata",
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(sbagliata.status()).toBe(401);
  await anonimo.dispose();
});
