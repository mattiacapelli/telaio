import { twentyDaEnv } from "@telaio/twenty";
import { autenticaChiave } from "@/lib/api-auth";
import { elencoClientiSchema } from "@/lib/api-schemi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await autenticaChiave(request, { scope: "api" });
  if (!auth.ok) return auth.risposta;
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  return Response.json(
    elencoClientiSchema.parse({ data: await twentyDaEnv().elencaClienti({ testo: q }) }),
  );
}
