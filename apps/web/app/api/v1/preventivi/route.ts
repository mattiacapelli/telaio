import { desc, getDb, isNull, preventivi } from "@telaio/db";
import { autenticaChiave } from "@/lib/api-auth";
import { elencoPreventiviSchema } from "@/lib/api-schemi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await autenticaChiave(request, { scope: "api" });
  if (!auth.ok) return auth.risposta;
  const righe = await getDb().select().from(preventivi).where(isNull(preventivi.deletedAt)).orderBy(desc(preventivi.createdAt)).limit(100);
  return Response.json(
    elencoPreventiviSchema.parse({
      data: righe.map((p) => ({ id: p.id, numero: p.numero, oggetto: p.oggetto, stato: p.stato, totaleCent: p.totaleCent, creatoIl: p.createdAt.toISOString() })),
    }),
  );
}
