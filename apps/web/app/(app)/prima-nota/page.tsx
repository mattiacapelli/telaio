import { formatEuro } from "@telaio/core";
import { alias, conti, desc, eq, getDb, isNull, movimenti, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { formatData, oggi } from "@/lib/date";
import { st } from "@/lib/utils";
import { registraMovimentoAction } from "./actions";

export const metadata = { title: "Prima nota" };
export const dynamic = "force-dynamic";

const TIPI = {
  entrata: { label: "Entrate", dot: "#3d7a4f" },
  uscita: { label: "Uscite", dot: "#b4532a" },
  giroconto: { label: "Giroconti", dot: "#2b5ea7" },
} as const;
const CATEGORIE = ["#17150f", "#2b5ea7", "#b4532a", "#969184", "#c3bfb4"];
const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export default async function PrimaNotaPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "tutti" } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
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
      .limit(300),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  const delMese = lista.filter(({ m }) => m.data >= inizioMese);
  const tot = (tipo: keyof typeof TIPI) =>
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
  const mostrati = t === "tutti" ? lista : lista.filter(({ m }) => m.tipo === t);
  const mese = Number(dataOggi.slice(5, 7));
  const incassiMese = delMese.filter(({ m }) => m.tipo === "entrata" && m.incassoId).length;

  const kpi = [
    {
      e: "Entrate",
      v: formatEuro(entrate),
      s: `${incassiMese} incass${incassiMese === 1 ? "o" : "i"} + altre entrate`,
    },
    {
      e: "Uscite",
      v: formatEuro(uscite),
      s: `${delMese.filter(({ m }) => m.tipo === "uscita").length} movimenti`,
    },
    { e: "Risultato del mese", v: formatEuro(entrate - uscite), s: "entrate meno uscite" },
    { e: "Giroconti", v: formatEuro(tot("giroconto")), s: "non cambiano la liquidità" },
  ];

  return (
    <>
      <TopBar placeholder="Cerca movimenti, fornitori…">
        <FormModal
          trigger="Nuovo movimento +"
          triggerSize="sm"
          title="Nuovo movimento"
          action={registraMovimentoAction}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 14,
            }}
          >
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 14,
            }}
          >
            <Field label="Importo (€)" name="importo">
              <Input name="importo" inputMode="decimal" required />
            </Field>
            <Field label="Categoria">
              <Input name="categoria" placeholder="es. Software, Tasse…" />
            </Field>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 14,
            }}
          >
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
      </TopBar>

      <PageHeader
        numero="10"
        sezione={`Prima nota · ${MESI[mese - 1]} ${dataOggi.slice(0, 4)}`}
        titolo="Entrate, uscite e giroconti"
        descrizione="Tutto ciò che entra o esce dai conti. Gli incassi arrivano da soli; spese e giroconti li registri qui. Nessun collegamento ai conti bancari reali."
      />

      <section
        className="card"
        style={st(
          "padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))",
        )}
      >
        {kpi.map((k, i) => (
          <div
            key={k.e}
            style={{
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRight: i < kpi.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
            }}
          >
            <span className="eb">{k.e}</span>
            <b
              className="d num"
              style={st("font-weight:600;font-size:30px;letter-spacing:-.02em;line-height:1")}
            >
              {k.v}
            </b>
            <span className="num" style={st("font-size:13px;color:#3a372f")}>
              {k.s}
            </span>
          </div>
        ))}
      </section>

      {categorie.length > 0 && (
        <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Uscite per categoria</h2>
            <span style={st("font-size:13px;color:#6b675c")}>{MESI[mese - 1]}</span>
          </div>
          <div style={st("display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px")}>
            {categorie.map(([c, v], i) => (
              <div
                key={c}
                title={c}
                style={{ flex: v, background: CATEGORIE[Math.min(i, CATEGORIE.length - 1)] }}
              />
            ))}
          </div>
          <div style={st("display:flex;flex-wrap:wrap;gap:10px 28px;font-size:14px")}>
            {categorie.map(([c, v], i) => (
              <span key={c} className="lg" style={{ fontSize: 14, color: "#17150f" }}>
                <i style={{ background: CATEGORIE[Math.min(i, CATEGORIE.length - 1)] }} />
                {c}{" "}
                <b className="num" style={{ fontWeight: 600 }}>
                  {formatEuro(v)}
                </b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px",
          )}
        >
          <h2 className="h2">Movimenti</h2>
          <div
            role="group"
            aria-label="Filtra per tipo"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            <Link href="/prima-nota" className={`chip${t === "tutti" ? " on" : ""}`}>
              Tutti <b>{lista.length}</b>
            </Link>
            {(Object.keys(TIPI) as (keyof typeof TIPI)[]).map((k) => (
              <Link key={k} href={`/prima-nota?t=${k}`} className={`chip${t === k ? " on" : ""}`}>
                {TIPI[k].label} <b>{lista.filter(({ m }) => m.tipo === k).length}</b>
              </Link>
            ))}
          </div>
        </div>
        {mostrati.length === 0 ? (
          <p style={st("margin:0;padding:12px 0;color:#3a372f")}>
            Nessun movimento: gli incassi registrati compaiono qui come entrate.
          </p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th>Ragione sociale</th>
                  <th>Conto</th>
                  <th>Tipo</th>
                  <th className="r">Importo</th>
                </tr>
              </thead>
              <tbody>
                {mostrati.map(({ m, conto, destinazione, emittente }) => {
                  const segno = m.tipo === "entrata" ? "+ " : m.tipo === "uscita" ? "− " : "";
                  return (
                    <tr key={m.id}>
                      <td className="num">{formatData(m.data)}</td>
                      <td>
                        <span style={st("font-weight:500;color:#17150f")}>
                          {m.descrizione ?? "—"}
                        </span>
                        {m.categoria && <span className="sub">{m.categoria}</span>}
                      </td>
                      <td>{emittente ?? "—"}</td>
                      <td>{destinazione ? `${conto} → ${destinazione}` : conto}</td>
                      <td>
                        <span className="tag">
                          <i style={{ background: TIPI[m.tipo].dot }} />
                          {TIPI[m.tipo].label.replace(/e$|i$/, (x) => (x === "e" ? "a" : "o"))}
                        </span>
                      </td>
                      <td className="r num" style={st("font-weight:600;color:#17150f")}>
                        {segno}
                        {formatEuro(m.importoCent)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
