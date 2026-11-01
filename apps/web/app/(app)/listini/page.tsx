import { formatAliquota, formatEuro, prezzoVisualizzato } from "@telaio/core";
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
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { regoleDa } from "@/lib/regole";
import { cn } from "@/lib/utils";
import { ListiniTabella, type RigaListino } from "./listini-tabella";

export const metadata = { title: "Listini" };
export const dynamic = "force-dynamic";

export default async function ListiniPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const { l: scelto } = await searchParams;
  const db = getDb();
  const [elenco, basi, moduli, assegn] = await Promise.all([
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
  ]);
  const corrente = elenco.find(({ l }) => l.id === scelto) ?? elenco[0];
  const voci = (id: string) =>
    basi.filter((b) => b.listinoId === id).length + moduli.filter((m) => m.listinoId === id).length;

  let righe: RigaListino[] = [];
  let nota = "";
  if (corrente) {
    const { l, rs } = corrente;
    const regole = regoleDa(rs);
    const b = basi.filter((x) => x.listinoId === l.id);
    const m = moduli.filter((x) => x.listinoId === l.id);
    const prezzo = (cent: number): [string, string | null] => {
      if (cent === 0) return ["—", null];
      const p = prezzoVisualizzato(cent, regole);
      return [formatEuro(p.nettoCent), p.lordoCent !== null ? formatEuro(p.lordoCent) : null];
    };
    const riga = (
      v: (typeof b)[number],
      tipo: RigaListino["tipo"],
      compatibili: string,
    ): RigaListino => ({
      id: v.id,
      nome: v.nome,
      tipo,
      compatibili,
      unaTantum: prezzo(v.unaTantumCent),
      canoneAnno: prezzo(v.canoneAnnuoCent),
      canoneMese: prezzo(v.canoneMensileCent),
      descrizione: v.descrizione,
    });
    righe = [
      ...b.map((v) => riga(v, "Base", "")),
      ...m.map((v) =>
        riga(
          v,
          "Add-on",
          assegn
            .filter((a) => a.moduloId === v.id)
            .map((a) => b.find((x) => x.id === a.baseId)?.nome)
            .filter(Boolean)
            .join(", "),
        ),
      ),
    ];
    nota = `Prezzi netti; con IVA per ${rs.nome} · ${regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "senza IVA"}.`;
  }

  return (
    <>
      <PageHeader
        titolo="Listini"
        descrizione="Prezzo una tantum e canoni per voce. Inserisci il netto: il prezzo con IVA lo calcola l'app con l'aliquota della ragione sociale che emette."
        azioni={
          <Button asChild variant="secondary">
            <Link href="/impostazioni/listini">Modifica listini</Link>
          </Button>
        }
      />
      {elenco.length === 0 || !corrente ? (
        <EmptyState title="Nessun listino" />
      ) : (
        <>
          <div role="tablist" aria-label="Listini" className="flex gap-4 border-b border-line">
            {elenco.map(({ l }) => (
              <Link
                key={l.id}
                href={`/listini?l=${l.id}`}
                role="tab"
                aria-selected={l.id === corrente.l.id}
                className={cn(
                  "-mb-px inline-flex h-9 items-center gap-2 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150",
                  l.id === corrente.l.id
                    ? "border-brand text-fg"
                    : "border-transparent text-fg-2 hover:text-fg",
                )}
              >
                {l.nome} <span className="text-xs font-normal text-fg-3">{voci(l.id)}</span>
              </Link>
            ))}
          </div>
          <p className="text-sm text-fg-2">{nota}</p>
          <ListiniTabella righe={righe} />
        </>
      )}
    </>
  );
}
