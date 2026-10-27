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
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { regoleDa } from "@/lib/regole";
import { st } from "@/lib/utils";
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
      <TopBar>
        <Link href="/preventivi" className="bp sm">
          Tutti i preventivi <span aria-hidden="true">→</span>
        </Link>
      </TopBar>
      <section
        style={st(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;align-items:end",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:14px")}>
          <span className="eb">04 — Configuratore rapido</span>
          <h1
            className="d"
            style={st(
              "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em;max-width:14ch",
            )}
          >
            Componi l&apos;offerta mentre sei al telefono.
          </h1>
        </div>
        <p style={st("margin:0;max-width:46ch;font-size:16px;line-height:1.7;color:#3a372f")}>
          Scegli la base: ti propongo solo i moduli compatibili. Prezzi e canoni arrivano dal
          listino, il totale si aggiorna subito.
        </p>
      </section>
      <Configuratore
        listini={cfg}
        clienti={clienti.map((c) => ({ id: c.id, nome: c.nome }))}
        clienteIniziale={cliente}
      />
    </>
  );
}
