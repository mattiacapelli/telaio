import { getDb } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { PreventivoEditor } from "@/components/domain/preventivo-editor";
import { caricaListiniCfg } from "@/lib/listini-cfg";

export const metadata = { title: "Nuovo preventivo" };
export const dynamic = "force-dynamic";

export default async function NuovoPreventivoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const [listini, clienti] = await Promise.all([
    caricaListiniCfg(getDb()),
    twentyDaEnv()
      .elencaClienti({ limite: 200 })
      .catch(() => []),
  ]);
  return (
    <PreventivoEditor
      listini={listini}
      clienti={clienti.map((c) => ({ id: c.id, nome: c.nome }))}
      clienteIniziale={cliente}
    />
  );
}
