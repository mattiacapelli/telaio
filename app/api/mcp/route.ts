import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { leggiSessione } from "@/lib/auth";
import { verificaChiave } from "@/lib/apikey";
import { TOOLS, schemaJson, Errore404, ErroreInput, type ToolContesto } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

/**
 * Server MCP di Telaio, esposto come singolo endpoint HTTP (JSON-RPC 2.0,
 * senza sessione SSE: ogni chiamata è una richiesta/risposta indipendente,
 * il modo più semplice che i client MCP remoti sanno già parlare).
 *
 * Autenticazione: API key generata da Impostazioni → Accessi, non la
 * sessione dell'app — un agente esterno non deve dipendere da un cookie di
 * navigazione, e revocare il suo accesso non deve disconnettere anche te.
 * `MCP_TOKEN` in `.env` resta come fallback per chi lo aveva già configurato
 * prima che esistessero le API key.
 */
const PROTOCOLLO = "2024-11-05";

async function autorizzato(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;

  if ((await verificaChiave(token)) !== null) return true;

  const atteso = process.env.MCP_TOKEN;
  return Boolean(atteso) && token === atteso;
}

type Richiesta = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

function rpcOk(id: Richiesta["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcErrore(id: Richiesta["id"], code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function POST(req: Request) {
  if (!(await autorizzato(req))) {
    return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });
  }

  const corpo = (await req.json().catch(() => null)) as Richiesta | null;
  if (!corpo || typeof corpo.method !== "string") {
    return rpcErrore(corpo?.id ?? null, -32600, "richiesta non valida");
  }
  const { id, method, params } = corpo;

  switch (method) {
    case "initialize":
      return rpcOk(id, {
        protocolVersion: PROTOCOLLO,
        serverInfo: { name: "telaio", version: "1.0.0" },
        capabilities: { tools: {} },
      });

    // Notifica del client, nessuna risposta attesa dal chiamante: un 200
    // vuoto basta, JSON-RPC non richiede reply a chi non passa un id.
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "tools/list":
      return rpcOk(id, {
        tools: Object.entries(TOOLS).map(([nome, tool]) => ({
          name: nome,
          description: tool.descrizione + (tool.scrittura ? "" : " (sola lettura)"),
          inputSchema: schemaJson(tool),
        })),
      });

    case "tools/call": {
      const nome = params?.name as string | undefined;
      const tool = nome ? TOOLS[nome] : undefined;
      if (!tool) return rpcErrore(id, -32602, `tool sconosciuto: ${nome}`);

      const parsed = tool.schema.safeParse(params?.arguments ?? {});
      if (!parsed.success) {
        const messaggio = parsed.error.issues[0]?.message ?? "argomenti non validi";
        return rpcOk(id, { isError: true, content: [{ type: "text", text: messaggio }] });
      }

      const ctx: ToolContesto = { autore: "AI (MCP)" };
      try {
        const risultato = await tool.esegui(parsed.data, ctx);
        return rpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(normalizza(risultato), null, 2) }],
        });
      } catch (err) {
        if (err instanceof Errore404 || err instanceof ErroreInput) {
          return rpcOk(id, { isError: true, content: [{ type: "text", text: err.message }] });
        }
        if (err instanceof ZodError) {
          return rpcOk(id, {
            isError: true,
            content: [{ type: "text", text: err.issues[0]?.message ?? "argomenti non validi" }],
          });
        }
        console.error("[mcp] errore tool", nome, err);
        return rpcOk(id, {
          isError: true,
          content: [{ type: "text", text: "errore interno nell'esecuzione del tool" }],
        });
      }
    }

    default:
      return rpcErrore(id, -32601, `metodo sconosciuto: ${method}`);
  }
}

/**
 * Converte ricorsivamente i Decimal di Prisma in number.
 *
 * `Decimal` implementa `toJSON()`, quindi un replacer di `JSON.stringify`
 * lo vedrebbe già come stringa: bisogna normalizzare l'oggetto prima di
 * serializzarlo, non durante.
 */
function normalizza(valore: unknown): unknown {
  if (Decimal.isDecimal(valore)) return Number(valore);
  if (valore instanceof Date) return valore;
  if (Array.isArray(valore)) return valore.map(normalizza);
  if (valore && typeof valore === "object") {
    return Object.fromEntries(
      Object.entries(valore).map(([k, v]) => [k, normalizza(v)]),
    );
  }
  return valore;
}

/** Nessuna sessione qui: serve solo a bloccare l'indicizzazione accidentale. */
export async function GET() {
  const sessione = await leggiSessione();
  return NextResponse.json({
    servizio: "telaio-mcp",
    protocollo: PROTOCOLLO,
    autenticato: Boolean(sessione),
  });
}
