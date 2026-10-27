import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL non impostata");
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), client };
}

// Una sola istanza per processo (anche con l'hot reload di Next in sviluppo).
const globalForDb = globalThis as unknown as { __telaioDb?: ReturnType<typeof createDb> };

export function getDb(): Database {
  globalForDb.__telaioDb ??= createDb();
  return globalForDb.__telaioDb.db;
}
