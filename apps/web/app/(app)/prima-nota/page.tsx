import { formatEuro } from "@telaio/core";
import { alias, conti, desc, eq, getDb, isNull, movimenti, ragioniSociali } from "@telaio/db";
import { MovimentoModal } from "@/components/domain/movimento-modal";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { MovimentiTabella, type RigaMovimento } from "./movimenti-tabella";

export const metadata = { title: "Prima nota" };
export const dynamic = "force-dynamic";

const GRIGI = ["#202124", "#3e63dd", "#777777", "#a0a0a0", "#d4d4d8"];

export default async function PrimaNotaPage() {
  const db = getDb();
  const inizioMese = `${oggi().slice(0, 7)}-01`;
  const dest = alias(conti, "conto_dest");
  const [lista, contiAttivi] = await Promise.all([
    db
      .select({
        m: movimenti,
        conto: conti.nome,
        destinazione: dest.nome,
        emittente: ragioniSociali.nome,
      })
      .from(movimenti)
      .innerJoin(conti, eq(conti.id, movimenti.contoId))
      .leftJoin(dest, eq(dest.id, movimenti.contoDestinazioneId))
      .leftJoin(ragioniSociali, eq(ragioniSociali.id, conti.ragioneSocialeId))
      .where(isNull(movimenti.deletedAt))
      .orderBy(desc(movimenti.data), desc(movimenti.createdAt))
      .limit(500),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  const delMese = lista.filter(({ m }) => m.data >= inizioMese);
  const tot = (tipo: "entrata" | "uscita" | "giroconto") =>
    delMese.filter(({ m }) => m.tipo === tipo).reduce((x, { m }) => x + m.importoCent, 0);
  const entrate = tot("entrata");
  const uscite = tot("uscita");
  const perCategoria = new Map<string, number>();
  for (const { m } of delMese)
    if (m.tipo === "uscita")
      perCategoria.set(
        m.categoria ?? "Senza categoria",
        (perCategoria.get(m.categoria ?? "Senza categoria") ?? 0) + m.importoCent,
      );
  const categorie = [...perCategoria.entries()].sort((a, b) => b[1] - a[1]);

  const righe: RigaMovimento[] = lista.map(({ m, conto, destinazione, emittente }) => ({
    id: m.id,
    data: m.data,
    descrizione: m.descrizione,
    categoria: m.categoria,
    emittente,
    conto,
    destinazione,
    tipo: m.tipo,
    importoCent: m.importoCent,
  }));

  return (
    <>
      <PageHeader
        titolo="Prima nota"
        descrizione="Tutto ciò che entra o esce dai conti. Gli incassi arrivano da soli; spese e giroconti li registri qui."
        azioni={<MovimentoModal conti={contiAttivi} />}
      />
      <StatsRow
        dati={[
          { etichetta: "Entrate del mese", valore: formatEuro(entrate) },
          { etichetta: "Uscite del mese", valore: formatEuro(uscite) },
          {
            etichetta: "Risultato",
            valore: formatEuro(entrate - uscite),
            nota: "entrate meno uscite",
          },
          {
            etichetta: "Giroconti",
            valore: formatEuro(tot("giroconto")),
            nota: "non cambiano la liquidità",
          },
        ]}
      />
      {categorie.length > 0 && (
        <Card>
          <CardHeader title="Uscite per categoria" description="Mese in corso" />
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {categorie.map(([c, v], i) => (
              <div
                key={c}
                title={c}
                style={{ flex: v, background: GRIGI[Math.min(i, GRIGI.length - 1)] }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {categorie.map(([c, v], i) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <i
                  className="size-2 rounded-sm"
                  style={{ background: GRIGI[Math.min(i, GRIGI.length - 1)] }}
                />
                {c} <b className="font-medium tabular-nums">{formatEuro(v)}</b>
              </span>
            ))}
          </div>
        </Card>
      )}
      <MovimentiTabella righe={righe} />
    </>
  );
}
