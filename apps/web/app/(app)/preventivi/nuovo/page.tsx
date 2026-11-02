import { getDb } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { PreventivoEditor } from "@/components/domain/preventivo-editor";
import { caricaEmittentiCfg } from "@/lib/emittenti-cfg";

export const metadata = { title: "Nuovo preventivo" };
export const dynamic = "force-dynamic";

export default async function NuovoPreventivoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const [emittenti, clienti] = await Promise.all([
    caricaEmittentiCfg(getDb()),
    twentyDaEnv()
      .elencaClienti({ limite: 200 })
      .catch(() => []),
  ]);
  return (
    <PreventivoEditor
      emittenti={emittenti}
      clienti={clienti.map((c) => ({ id: c.id, nome: c.nome }))}
      clienteIniziale={cliente}
    />
  );
}
