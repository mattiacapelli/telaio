import { caricaFile } from "@/lib/archivio/carica";

export const dynamic = "force-dynamic";

/** Carica file nel preventivo. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return caricaFile(request, { preventivoId: id });
}
