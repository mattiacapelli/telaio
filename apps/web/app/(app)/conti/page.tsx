import { formatEuro } from "@telaio/core";
import { conti, desc, eq, getDb, incassi, isNull, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { ContoModal } from "@/components/domain/conto-modal";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { formatData } from "@/lib/date";
import { saldiConti } from "@/lib/dominio/movimenti";
import { cn } from "@/lib/utils";

export const metadata = { title: "Conti" };
export const dynamic = "force-dynamic";

const TIPI: Record<string, { etichetta: string; variante: VarianteBadge }> = {
  bonifico: { etichetta: "Conto corrente", variante: "brand" },
  contante: { etichetta: "Contanti", variante: "neutral" },
  carta: { etichetta: "Carta / POS", variante: "ok" },
};

export default async function ContiPage({
  searchParams,
}: {
  searchParams: Promise<{ em?: string }>;
}) {
  const { em } = await searchParams;
  const db = getDb();
  const [lista, saldi, emittenti, ultimi] = await Promise.all([
    db
      .select({ c: conti, rs: ragioniSociali.nome })
      .from(conti)
      .leftJoin(ragioniSociali, eq(ragioniSociali.id, conti.ragioneSocialeId))
      .where(isNull(conti.deletedAt))
      .orderBy(conti.nome),
    saldiConti(db),
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .selectDistinctOn([incassi.contoId], {
        contoId: incassi.contoId,
        data: incassi.data,
        importoCent: incassi.importoCent,
        descrizione: incassi.descrizione,
      })
      .from(incassi)
      .where(isNull(incassi.deletedAt))
      .orderBy(incassi.contoId, desc(incassi.data), desc(incassi.createdAt)),
  ]);
  const mostrati = em ? lista.filter(({ c }) => c.ragioneSocialeId === em) : lista;
  const totale = mostrati.reduce((s, { c }) => s + (saldi.get(c.id) ?? c.saldoInizialeCent), 0);
  const ultimo = new Map(ultimi.map((u) => [u.contoId, u]));

  return (
    <>
      <PageHeader
        titolo="Conti"
        descrizione="Correnti per i bonifici, cassa per il contante, carte e POS. Il saldo è il saldo iniziale più i movimenti di prima nota."
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/prima-nota">Giroconto</Link>
            </Button>
            <ContoModal emittenti={emittenti} />
          </>
        }
      />
      <StatsRow
        dati={[
          {
            etichetta: "Liquidità totale",
            valore: formatEuro(totale),
            nota: `${mostrati.length} cont${mostrati.length === 1 ? "o" : "i"}`,
          },
        ]}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per ragione sociale">
        {[{ id: "", nome: "Tutte" }, ...emittenti].map((e) => (
          <Link
            key={e.id || "tutte"}
            href={e.id ? `/conti?em=${e.id}` : "/conti"}
            className={cn(
              "inline-flex h-7 items-center rounded-md border px-2.5 text-sm transition-colors duration-150",
              (em ?? "") === e.id
                ? "border-transparent bg-fg text-white"
                : "border-line bg-surface text-fg-2 hover:bg-hover",
            )}
          >
            {e.nome}
          </Link>
        ))}
      </div>
      {mostrati.length === 0 ? (
        <Card className="p-0">
          <EmptyState title="Nessun conto" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mostrati.map(({ c, rs }) => {
            const u = ultimo.get(c.id);
            const tipo = TIPI[c.tipo];
            return (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={tipo?.variante ?? "neutral"} dot>
                    {tipo?.etichetta ?? c.tipo}
                  </Badge>
                  <span className="text-xs text-fg-3">{rs ?? "Condiviso"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-semibold">{c.nome}</span>
                  <span className="text-sm text-fg-2">
                    {c.iban
                      ? `IBAN ${c.iban.slice(0, 4)}•• •••• •••• ${c.iban.slice(-4)}`
                      : c.tipo === "contante"
                        ? "Cassa fisica"
                        : "—"}
                  </span>
                </div>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatEuro(saldi.get(c.id) ?? c.saldoInizialeCent)}
                </span>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-sm text-fg-2">
                  <span className="truncate">
                    {u
                      ? `${formatData(u.data).slice(0, 5)} · ${u.descrizione ?? "Incasso"}`
                      : "Nessun incasso"}
                  </span>
                  {u && (
                    <b className="font-medium whitespace-nowrap text-ok tabular-nums">
                      + {formatEuro(u.importoCent)}
                    </b>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
