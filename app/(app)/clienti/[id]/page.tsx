import Link from "next/link";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/queries";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eur, eurCent, ore, data, n } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCliente(id);
  if (!c) notFound();

  const fatturato = c.fatture
    .filter((f) => f.stato !== "DA_EMETTERE")
    .reduce((s, f) => s + n(f.imponibile), 0);
  const incassato = c.fatture.reduce(
    (s, f) => s + f.incassi.reduce((x, i) => x + n(i.importo), 0),
    0,
  );

  return (
    <div className="tl-in flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/clienti"
          className="h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-xs text-muted hover:border-border2 hover:text-text"
        >
          ← Clienti
        </Link>
        <span className="text-xs text-faint">
          {c.ragioneSociale} · scheda cliente
        </span>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 flex-none place-items-center rounded-md bg-surface3 text-xs font-semibold">
            {c.sigla}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{c.ragioneSociale}</div>
            <div className="text-xs text-muted">
              {[c.partitaIva && `P.IVA ${c.partitaIva}`, c.citta]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
          {c.twentyId && (
            <div className="flex items-center gap-2">
              <Badge tono="accento">Sincronizzato da Twenty</Badge>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Tariffa oraria", eurCent(c.tariffaOraria)],
            ["Termini pagamento", `${c.terminiPagamento} gg d.f.`],
            ["Fatturato", eur(fatturato)],
            ["Incassato", eur(incassato)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface2 px-3 py-2">
              <div className="text-xxs text-faint">{k}</div>
              <div className="mt-0.5 text-sm font-medium">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead titolo="Referenti" />
          {c.referenti.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint">
              Nessun referente
            </div>
          ) : (
            c.referenti.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs">
                    {r.nome} {r.cognome}
                  </div>
                  <div className="truncate text-xxs text-faint">
                    {[r.ruolo, r.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {r.principale && <Badge>principale</Badge>}
              </div>
            ))
          )}
        </Card>

        <Card>
          <CardHead titolo="Progetti" />
          {c.progetti.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint">
              Nessun progetto
            </div>
          ) : (
            c.progetti.map((p) => (
              <Link
                key={p.id}
                href={`/progetti/${p.id}`}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-surface2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{p.nome}</div>
                  <div className="text-xxs text-faint">
                    {ore(p.registrazioni.reduce((s, r) => s + n(r.ore), 0))} /{" "}
                    {ore(p.budgetOre)}
                  </div>
                </div>
                <span className="text-xs text-muted">{eur(p.valore)}</span>
              </Link>
            ))
          )}
        </Card>

        <Card>
          <CardHead
            titolo="Ticket e interventi"
            extra={
              <Link href="/ticket" className="text-xs text-muted hover:text-text">
                Tutti
              </Link>
            }
          />
          {c.ticket.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint">
              Nessun ticket
            </div>
          ) : (
            c.ticket.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
              >
                <span className="text-xs text-faint">#{t.numero}</span>
                <div className="min-w-0 flex-1 truncate text-xs">
                  {t.titolo}
                </div>
                <Badge>{t.stato.toLowerCase().replace("_", " ")}</Badge>
              </div>
            ))
          )}
        </Card>

        <Card>
          <CardHead titolo="Fatture" />
          {c.fatture.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint">
              Nessuna fattura
            </div>
          ) : (
            c.fatture.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
              >
                <span className="text-xs">{f.numero}</span>
                <div className="flex-1 text-xxs text-faint">
                  {f.emessaIl ? data(f.emessaIl) : "da emettere"}
                </div>
                <span className="text-xs">{eur(f.imponibile)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
