import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { desc, eq, getDb, impostazioni, pendingActions } from "@telaio/db";
import { z } from "zod";
import type { ChiaveApi } from "../api-auth";
import { audit } from "../audit";
import { proponiAzione } from "../dominio/pending";
import { eseguiStrumento, preparaInput, STRUMENTI } from "./esegui";
import { richiedeApprovazione, STRUMENTI_MCP, STRUMENTO_STATO_AZIONE } from "./registro";

const json = (dati: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(dati, null, 2) }],
});
const errore = (testo: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: testo }],
});

/**
 * Un server MCP per richiesta. Ogni strumento si attiva da Impostazioni → MCP e può richiedere
 * l'approvazione dell'admin: in quel caso la chiamata crea una azione in attesa invece di
 * eseguire, e l'esito si legge con `stato_azione` dopo la conferma.
 */
export async function creaServerMcp(chiave: ChiaveApi): Promise<McpServer> {
  const db = getDb();
  const server = new McpServer({ name: "telaio", version: "0.1.0" });

  const [[attivi], [approvazioni]] = await Promise.all([
    db.select().from(impostazioni).where(eq(impostazioni.chiave, "mcp.strumenti")),
    db.select().from(impostazioni).where(eq(impostazioni.chiave, "mcp.approvazione")),
  ]);
  const abilitati = (attivi?.valore ?? {}) as Record<string, boolean>;
  const richieste = (approvazioni?.valore ?? {}) as Record<string, boolean>;

  for (const def of STRUMENTI_MCP) {
    const registrato = STRUMENTI[def.nome];
    if (!registrato) continue;
    if (abilitati[def.nome] === false) continue;
    if (def.scrittura && chiave.permessi !== "lettura_scrittura") continue;
    const conferma = richiedeApprovazione(def, richieste);

    server.registerTool(
      def.nome,
      {
        description: `${def.descrizione}${conferma ? " Richiede l'approvazione dell'utente in Telaio." : ""}`,
        inputSchema: registrato.shape,
      },
      async (input) => {
        try {
          if (conferma) {
            const payload = preparaInput(def.nome, input);
            const azione = await proponiAzione(db, {
              tipo: def.nome,
              payload,
              apiKeyId: chiave.id,
            });
            return json({
              stato: "in_attesa_di_conferma",
              pendingActionId: azione?.id,
              nota: "L'utente deve confermare in Telaio → Azioni in attesa. Poi leggi l'esito con stato_azione.",
            });
          }
          const risultato = await eseguiStrumento(db, def.nome, input);
          if (def.scrittura) {
            await audit(db, {
              apiKeyId: chiave.id,
              azione: `mcp.${def.nome}`,
              entita: "mcp",
              dettagli: { eseguitaSenzaApprovazione: true },
            });
          }
          return json(risultato);
        } catch (e) {
          return errore(e instanceof Error ? e.message : "Operazione non riuscita");
        }
      },
    );
  }

  // Serve a leggere l'esito di ciò che l'utente ha approvato (o rifiutato).
  server.registerTool(
    STRUMENTO_STATO_AZIONE,
    {
      description:
        "Stato di una azione proposta (in attesa, confermata, rifiutata, fallita) e, se eseguita, il suo risultato.",
      inputSchema: { pendingActionId: z.uuid() },
    },
    async ({ pendingActionId }) => {
      const [a] = await db
        .select({
          id: pendingActions.id,
          tipo: pendingActions.tipo,
          stato: pendingActions.stato,
          risultato: pendingActions.risultato,
          errore: pendingActions.errore,
        })
        .from(pendingActions)
        .where(eq(pendingActions.id, pendingActionId))
        .orderBy(desc(pendingActions.createdAt));
      return a ? json(a) : errore("Azione non trovata");
    },
  );

  return server;
}
