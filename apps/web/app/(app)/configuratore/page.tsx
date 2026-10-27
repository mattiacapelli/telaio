import {
  asc,
  eq,
  getDb,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { PageHeader } from "@/components/ui/page-header";
import { regoleDa } from "@/lib/regole";
import { Configuratore, type ListinoCfg } from "./configuratore";

export const metadata = { title: "Configuratore" };
export const dynamic = "force-dynamic";

export default async function ConfiguratorePage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const db = getDb();
  const [elenco, basi, moduli, assegn, clienti] = await Promise.all([
    db
      .select({ l: listini, rs: ragioniSociali })
      .from(listini)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId))
      .where(isNull(listini.deletedAt))
      .orderBy(asc(listini.createdAt)),
    db
      .select()
      .from(listinoBasi)
      .where(isNull(listinoBasi.deletedAt))
      .orderBy(asc(listinoBasi.ordine)),
    db
      .select()
      .from(listinoModuli)
      .where(isNull(listinoModuli.deletedAt))
      .orderBy(asc(listinoModuli.ordine)),
    db.select().from(moduloBasi),
    twentyDaEnv()
      .elencaClienti({ limite: 100 })
      .catch(() => []),
  ]);

  const voce = (v: (typeof basi)[number]) => ({
    id: v.id,
    nome: v.nome,
    descrizione: v.descrizione,
    unaTantumCent: v.unaTantumCent,
    canoneAnnuoCent: v.canoneAnnuoCent,
    canoneMensileCent: v.canoneMensileCent,
  });
  const cfg: ListinoCfg[] = elenco
    .filter(({ rs }) => !rs.deletedAt)
    .map(({ l, rs }) => ({
      id: l.id,
      nome: l.nome,
      ragioneSocialeId: rs.id,
      ragioneSociale: rs.nome,
      regole: regoleDa(rs),
      basi: basi.filter((b) => b.listinoId === l.id).map(voce),
      moduli: moduli
        .filter((m) => m.listinoId === l.id)
        .map((m) => ({
          ...voce(m),
          baseIds: assegn.filter((a) => a.moduloId === m.id).map((a) => a.baseId),
        })),
    }));

  return (
    <>
      <PageHeader
        numero="03"
        sezione="Commerciale"
        titolo="Configuratore"
        descrizione="Scegli la base: ti propongo solo i moduli compatibili e calcolo i totali."
      />
      <Configuratore
        listini={cfg}
        clienti={clienti.map((c) => ({ id: c.id, nome: c.nome }))}
        clienteIniziale={cliente}
      />
    </>
  );
}
