import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prezzoVisualizzato } from "@telaio/core";
import { and, desc, eq, getDb, impostazioni, isNull, listinoBasi, listinoModuli, listini, moduloBasi, preventivi, ragioniSociali } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { z } from "zod";
import type { ChiaveApi } from "../api-auth";
import { creaPreventivoSchema } from "../dominio/preventivi";
import { proponiAzione } from "../dominio/pending";
import { regoleDa } from "../regole";
import { STRUMENTI_MCP } from "./registro";

const json = (dati: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(dati, null, 2) }] });
const nonImplementato = (nome: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: `Lo strumento ${nome} è dichiarato ma non ancora implementato.` }],
});

export async function creaServerMcp(chiave: ChiaveApi): Promise<McpServer> {
  const db = getDb();
  const server = new McpServer({ name: "telaio", version: "0.1.0" });

  // Gli strumenti si attivano/disattivano da Impostazioni → MCP (default: tutti attivi).
  const [impo] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, "mcp.strumenti"));
  const attivi = (impo?.valore ?? {}) as Record<string, boolean>;
  const abilitato = (nome: string, scrittura: boolean) =>
    attivi[nome] !== false && (!scrittura || chiave.permessi === "lettura_scrittura");

  const def = (nome: string) => {
    const s = STRUMENTI_MCP.find((x) => x.nome === nome);
    if (!s) throw new Error(`Strumento sconosciuto: ${nome}`);
    return s;
  };

  if (abilitato("cerca_clienti", false)) {
    server.registerTool(
      "cerca_clienti",
      { description: def("cerca_clienti").descrizione, inputSchema: { testo: z.string().optional(), limite: z.number().int().min(1).max(50).optional() } },
      async ({ testo, limite }) => json(await twentyDaEnv().elencaClienti({ testo, limite })),
    );
  }

  if (abilitato("dettaglio_cliente", false)) {
    server.registerTool("dettaglio_cliente", { description: def("dettaglio_cliente").descrizione, inputSchema: { id: z.string() } }, async () => nonImplementato("dettaglio_cliente"));
  }

  if (abilitato("elenca_preventivi", false)) {
    server.registerTool(
      "elenca_preventivi",
      { description: def("elenca_preventivi").descrizione, inputSchema: { stato: z.enum(["bozza", "inviato", "in_revisione", "accettato", "rifiutato", "scaduto"]).optional() } },
      async ({ stato }) => {
        const righe = await db
          .select({ id: preventivi.id, numero: preventivi.numero, oggetto: preventivi.oggetto, stato: preventivi.stato, totaleCent: preventivi.totaleCent })
          .from(preventivi)
          .where(and(isNull(preventivi.deletedAt), stato ? eq(preventivi.stato, stato) : undefined))
          .orderBy(desc(preventivi.createdAt))
          .limit(50);
        return json(righe);
      },
    );
  }

  if (abilitato("listino", false)) {
    server.registerTool("listino", { description: def("listino").descrizione, inputSchema: {} }, async () => {
      const [elenco, basi, moduli, assegn] = await Promise.all([
        db.select({ l: listini, rs: ragioniSociali }).from(listini).innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId)).where(isNull(listini.deletedAt)),
        db.select().from(listinoBasi).where(isNull(listinoBasi.deletedAt)),
        db.select().from(listinoModuli).where(isNull(listinoModuli.deletedAt)),
        db.select().from(moduloBasi),
      ]);
      return json(
        elenco.map(({ l, rs }) => {
          const regole = regoleDa(rs);
          const prezzi = (v: { unaTantumCent: number; canoneAnnuoCent: number; canoneMensileCent: number }) => ({
            unaTantum: prezzoVisualizzato(v.unaTantumCent, regole),
            canoneAnnuo: prezzoVisualizzato(v.canoneAnnuoCent, regole),
            canoneMensile: prezzoVisualizzato(v.canoneMensileCent, regole),
          });
          return {
            id: l.id,
            nome: l.nome,
            ragioneSociale: rs.nome,
            basi: basi.filter((b) => b.listinoId === l.id).map((b) => ({ id: b.id, nome: b.nome, prezzi: prezzi(b) })),
            moduli: moduli
              .filter((m) => m.listinoId === l.id)
              .map((m) => ({ id: m.id, nome: m.nome, prezzi: prezzi(m), baseIds: assegn.filter((a) => a.moduloId === m.id).map((a) => a.baseId) })),
          };
        }),
      );
    });
  }

  for (const nome of ["scadenzario", "cash_flow"] as const) {
    if (abilitato(nome, false)) server.registerTool(nome, { description: def(nome).descrizione, inputSchema: {} }, async () => nonImplementato(nome));
  }

  // Scritture: creano una pending_action, mai una scrittura diretta sulle tabelle di dominio.
  if (abilitato("crea_preventivo", true)) {
    server.registerTool("crea_preventivo", { description: def("crea_preventivo").descrizione, inputSchema: creaPreventivoSchema.shape }, async (input) => {
      const payload = creaPreventivoSchema.parse(input);
      const azione = await proponiAzione(db, { tipo: "crea_preventivo", payload, apiKeyId: chiave.id });
      return json({ stato: "in_attesa_di_conferma", pendingActionId: azione?.id, nota: "L'utente deve confermare in Telaio → Azioni in attesa." });
    });
  }
  for (const nome of ["registra_incasso", "emetti_fattura"] as const) {
    if (abilitato(nome, true)) server.registerTool(nome, { description: def(nome).descrizione, inputSchema: {} }, async () => nonImplementato(nome));
  }

  return server;
}
