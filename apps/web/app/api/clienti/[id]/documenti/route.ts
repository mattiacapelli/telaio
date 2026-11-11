import { caricaFile } from "@/lib/archivio/carica";

export const dynamic = "force-dynamic";

/** Carica file nel cliente; `id` è quello locale (`clienti_ref`), non quello di Twenty. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return caricaFile(request, { clienteRefId: id });
}
