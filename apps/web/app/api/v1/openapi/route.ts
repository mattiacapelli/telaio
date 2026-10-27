import { documentoOpenApi } from "@/lib/api-schemi";

export const dynamic = "force-dynamic";

/** Documento OpenAPI pubblico (non contiene dati). */
export async function GET(request: Request) {
  return Response.json(documentoOpenApi(new URL(request.url).origin));
}
