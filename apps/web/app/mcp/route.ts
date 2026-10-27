import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { autenticaChiave } from "@/lib/api-auth";
import { creaServerMcp } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

/** MCP via Streamable HTTP, senza stato: un server per richiesta. Auth: chiave API con ambito `mcp`. */
async function gestisci(request: Request) {
  const auth = await autenticaChiave(request, { scope: "mcp" });
  if (!auth.ok) return auth.risposta;
  const server = await creaServerMcp(auth.chiave);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { gestisci as GET, gestisci as POST, gestisci as DELETE };
