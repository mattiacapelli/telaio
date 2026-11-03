import { clienteSchema } from "@telaio/twenty";
import { z } from "zod";

/** Schemi Zod della API v1: la stessa fonte alimenta le risposte e il documento OpenAPI. */
export const preventivoApiSchema = z.object({
  id: z.uuid(),
  numero: z.string().nullable(),
  oggetto: z.string(),
  stato: z.enum([
    "bozza",
    "inviato",
    "in_revisione",
    "accettato",
    "accettato_parzialmente",
    "rifiutato",
    "scaduto",
  ]),
  totaleCent: z.number().int(),
  creatoIl: z.string(),
});

export const elencoPreventiviSchema = z.object({ data: z.array(preventivoApiSchema) });
export const elencoClientiSchema = z.object({ data: z.array(clienteSchema) });

export function documentoOpenApi(baseUrl: string) {
  const risposta = (schema: z.ZodType) => ({
    "200": {
      description: "OK",
      content: { "application/json": { schema: z.toJSONSchema(schema) } },
    },
    "401": { description: "Chiave API mancante o non valida" },
    "429": { description: "Rate limit superato" },
  });
  return {
    openapi: "3.1.0",
    info: {
      title: "Telaio API",
      version: "1.0.0",
      description: "Importi in centesimi, percentuali in punti base.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: { securitySchemes: { chiaveApi: { type: "http", scheme: "bearer" } } },
    security: [{ chiaveApi: [] }],
    paths: {
      "/preventivi": {
        get: { summary: "Elenco preventivi", responses: risposta(elencoPreventiviSchema) },
      },
      "/clienti": {
        get: {
          summary: "Elenco clienti (da Twenty)",
          parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
          responses: risposta(elencoClientiSchema),
        },
      },
    },
  };
}
