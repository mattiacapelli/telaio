import { formatEuro } from "@telaio/core";
import { alias, conti, desc, eq, getDb, isNull, movimenti } from "@telaio/db";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { registraMovimentoAction } from "./actions";

export const metadata = { title: "Prima nota" };
export const dynamic = "force-dynamic";

const TIPI = {
  entrata: ["Entrata", "green"],
  uscita: ["Uscita", "orange"],
  giroconto: ["Giroconto", "blue"],
} as const;

export default async function PrimaNotaPage() {
  const db = getDb();
  const dest = alias(conti, "conto_dest");
  const [lista, contiAttivi] = await Promise.all([
    db
      .select({ m: movimenti, conto: conti.nome, destinazione: dest.nome })
      .from(movimenti)
      .innerJoin(conti, eq(conti.id, movimenti.contoId))
      .leftJoin(dest, eq(dest.id, movimenti.contoDestinazioneId))
      .where(isNull(movimenti.deletedAt))
      .orderBy(desc(movimenti.data), desc(movimenti.createdAt))
      .limit(200),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  return (
    <>
      <PageHeader
        numero="10"
        sezione="Amministrazione"
        titolo="Prima nota"
        descrizione="Entrate, uscite e giroconti che registri tu. Nessun collegamento ai conti bancari reali."
        azione={
          <FormModal
            trigger="Nuovo movimento"
            title="Nuovo movimento"
            action={registraMovimentoAction}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" name="tipo">
                <Select name="tipo" defaultValue="uscita">
                  <option value="entrata">Entrata</option>
                  <option value="uscita">Uscita</option>
                  <option value="giroconto">Giroconto tra conti</option>
                </Select>
              </Field>
              <Field label="Data" name="data">
                <Input name="data" type="date" required defaultValue={oggi()} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Importo (€)" name="importo">
                <Input name="importo" inputMode="decimal" required />
              </Field>
              <Field label="Categoria">
                <Input name="categoria" placeholder="es. Software, Tasse…" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conto" name="contoId">
                <Select name="contoId" required>
                  {contiAttivi.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Conto di destinazione"
                hint="Solo per i giroconti"
                name="contoDestinazioneId"
              >
                <Select name="contoDestinazioneId" defaultValue="">
                  <option value="">—</option>
                  {contiAttivi.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Descrizione">
              <Input name="descrizione" />
            </Field>
          </FormModal>
        }
      />
      {lista.length === 0 ? (
        <EmptyState title="Nessun movimento">
          Gli incassi registrati compaiono qui come entrate.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">Conto</th>
                <th className="px-4 py-3 text-right font-medium">Importo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ m, conto, destinazione }) => {
                const [label, tone] = TIPI[m.tipo];
                const segno = m.tipo === "entrata" ? "+" : m.tipo === "uscita" ? "−" : "";
                return (
                  <tr key={m.id} className="border-t border-grey-2/60">
                    <td className="px-4 py-3 tabular-nums">{formatData(m.data)}</td>
                    <td className="px-4 py-3">
                      <Tag tone={tone}>{label}</Tag>
                    </td>
                    <td className="px-4 py-3">
                      {m.descrizione ?? "—"}
                      {m.categoria && (
                        <span className="ml-2 text-xs text-muted">{m.categoria}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {destinazione ? `${conto} → ${destinazione}` : conto}
                    </td>
                    <td className="money px-4 py-3 text-right tabular-nums">
                      {segno}
                      {formatEuro(m.importoCent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
