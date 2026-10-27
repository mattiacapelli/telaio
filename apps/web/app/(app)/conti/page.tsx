import { formatEuro } from "@telaio/core";
import { conti, desc, eq, getDb, incassi, isNull, ragioniSociali, sql } from "@telaio/db";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { formatData } from "@/lib/date";
import { saldiConti } from "@/lib/dominio/movimenti";
import { st } from "@/lib/utils";
import { creaContoAction } from "./actions";

export const metadata = { title: "Conti" };
export const dynamic = "force-dynamic";

const TIPI = {
  bonifico: { label: "Bonifico", dot: "#17150f" },
  contante: { label: "Contante", dot: "#969184" },
  carta: { label: "Credito", dot: "#2b5ea7" },
} as const;

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
  void sql;
  const mostrati = em ? lista.filter(({ c }) => c.ragioneSocialeId === em) : lista;
  const totale = mostrati.reduce((s, { c }) => s + (saldi.get(c.id) ?? c.saldoInizialeCent), 0);
  const ultimo = new Map(ultimi.map((u) => [u.contoId, u]));

  return (
    <>
      <TopBar links={[{ label: "Incassi", href: "/incassi" }]}>
        <FormModal
          trigger="Nuovo conto +"
          triggerSize="sm"
          title="Nuovo conto"
          description="Conti correnti, cassa contante o carte/POS."
          action={creaContoAction}
        >
          <Field label="Nome" name="nome">
            <Input name="nome" required placeholder="C/C Ditta individuale" />
          </Field>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 14,
            }}
          >
            <Field label="Tipo" name="tipo">
              <Select name="tipo" defaultValue="bonifico">
                <option value="bonifico">Conto corrente (bonifico)</option>
                <option value="contante">Cassa contanti</option>
                <option value="carta">Carte / POS (credito)</option>
              </Select>
            </Field>
            <Field label="Ragione sociale" name="ragioneSocialeId" hint="Vuoto = conto condiviso">
              <Select name="ragioneSocialeId" defaultValue="">
                <option value="">Condiviso</option>
                {emittenti.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="IBAN" name="iban">
              <Input name="iban" />
            </Field>
            <Field label="Saldo iniziale (€)" name="saldoIniziale">
              <Input name="saldoIniziale" inputMode="decimal" defaultValue="0" />
            </Field>
          </div>
        </FormModal>
      </TopBar>

      <PageHeader
        numero="11"
        sezione="Conti"
        titolo="Conti"
        descrizione="Tre tipi di conto: correnti per i bonifici, cassa per il contante, carte e POS per il credito. Ogni conto appartiene a una ragione sociale o è condiviso. Il saldo è il saldo iniziale più i movimenti di prima nota."
        azione={
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            <Link href="/prima-nota" className="bg sm">
              Giroconto
            </Link>
          </div>
        }
      />

      <section
        style={st(
          "display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between;border-top:1px solid rgba(23,21,15,.14);padding-top:24px",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:8px")}>
          <span className="eb">Liquidità totale</span>
          <b
            className="d num"
            style={st(
              "font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
            )}
          >
            {formatEuro(totale)}
          </b>
        </div>
        <div
          role="group"
          aria-label="Filtra per ragione sociale"
          style={st("display:flex;flex-wrap:wrap;gap:8px")}
        >
          <Link href="/conti" className={`chip${em ? "" : " on"}`}>
            Tutte
          </Link>
          {emittenti.map((e) => (
            <Link
              key={e.id}
              href={`/conti?em=${e.id}`}
              className={`chip${em === e.id ? " on" : ""}`}
            >
              {e.nome}
            </Link>
          ))}
        </div>
      </section>

      {mostrati.length === 0 ? (
        <p style={st("margin:0;color:#3a372f")}>Nessun conto.</p>
      ) : (
        <section
          style={st(
            "display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;align-items:stretch",
          )}
        >
          {mostrati.map(({ c, rs }) => {
            const u = ultimo.get(c.id);
            return (
              <div
                key={c.id}
                className="card"
                style={st("display:flex;flex-direction:column;gap:14px;padding:24px")}
              >
                <div
                  style={st(
                    "display:flex;justify-content:space-between;align-items:center;gap:10px",
                  )}
                >
                  <span className="tag">
                    <i style={{ background: TIPI[c.tipo].dot }} />
                    {TIPI[c.tipo].label}
                  </span>
                  <span style={st("font-size:12px;color:#6b675c")}>{rs ?? "Condiviso"}</span>
                </div>
                <div style={st("display:flex;flex-direction:column;gap:4px")}>
                  <span
                    className="d"
                    style={st("font-size:22px;font-weight:600;letter-spacing:-.015em")}
                  >
                    {c.nome}
                  </span>
                  <span style={st("font-size:13px;color:#3a372f")}>
                    {c.iban
                      ? `IBAN ${c.iban.slice(0, 4)}•• •••• •••• ${c.iban.slice(-4)}`
                      : c.tipo === "contante"
                        ? "Cassa fisica"
                        : "—"}
                  </span>
                </div>
                <b
                  className="d num"
                  style={st("font-size:32px;font-weight:600;letter-spacing:-.025em;line-height:1")}
                >
                  {formatEuro(saldi.get(c.id) ?? c.saldoInizialeCent)}
                </b>
                <div
                  style={st(
                    "display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(23,21,15,.08);padding-top:12px;font-size:13px;color:#3a372f;margin-top:auto",
                  )}
                >
                  <span>
                    {u
                      ? `${formatData(u.data).slice(0, 5)} · ${u.descrizione ?? "Incasso"}`
                      : "Nessun incasso"}
                  </span>
                  {u && (
                    <b className="num" style={{ fontWeight: 600 }}>
                      + {formatEuro(u.importoCent)}
                    </b>
                  )}
                </div>
                <div style={st("display:flex;gap:6px")}>
                  <Link href="/prima-nota" className="bg sm">
                    Movimenti
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
