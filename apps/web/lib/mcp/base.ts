import type { Database } from "@telaio/db";
import type { z } from "zod";

export interface Strumento {
  /** forma dei parametri, come la vuole l'SDK MCP */
  shape: z.ZodRawShape;
  /** applica i valori di default prima di salvare la proposta o di eseguire */
  prepara?: (input: Record<string, unknown>) => Record<string, unknown>;
  esegui: (db: Database, input: never) => Promise<unknown>;
}

export const strumento = <S extends z.ZodRawShape>(
  shape: S,
  esegui: (db: Database, input: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  prepara?: (input: Record<string, unknown>) => Record<string, unknown>,
): Strumento => ({ shape, esegui: esegui as Strumento["esegui"], prepara });
