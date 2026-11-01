import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/schema";

// Come in sviluppo: il .env della radice, se c'è. In CI si usa TEST_DATABASE_URL.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {}

/** Server Postgres su cui creare i database di prova. Senza, i test di integrazione si saltano. */
export const URL_SERVER = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

function conNome(url: string, nome: string) {
  const u = new URL(url);
  u.pathname = `/${nome}`;
  return u.toString();
}

export interface DbTemporaneo {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: postgres.Sql;
  url: string;
  elimina: () => Promise<void>;
}

/** Crea un database vuoto con tutte le migrazioni applicate, come una installazione nuova. */
export async function creaDbTemporaneo(): Promise<DbTemporaneo> {
  if (!URL_SERVER) throw new Error("Nessun database per i test (TEST_DATABASE_URL o DATABASE_URL)");
  const nome = `telaio_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(conNome(URL_SERVER, "postgres"), { max: 1 });
  await admin.unsafe(`CREATE DATABASE "${nome}"`);
  const url = conNome(URL_SERVER, nome);
  const sql = postgres(url, { max: 12, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  return {
    db,
    sql,
    url,
    elimina: async () => {
      await sql.end({ timeout: 2 });
      await admin.unsafe(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
      await admin.end({ timeout: 2 });
    },
  };
}
