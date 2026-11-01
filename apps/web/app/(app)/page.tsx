import {
  formatEuro,
  formatEuroCompatto,
  prezzoVisualizzato,
  type RegoleFiscali,
} from "@telaio/core";
import {
  abbonamenti,
  and,
  clientiRef,
  conti,
  eq,
  getDb,
  inArray,
  isNull,
  pendingActions,
  preventivi,
  ragioniSociali,
  rate,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterLinks } from "@/components/ui/filter-links";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { saldiConti } from "@/lib/dominio/movimenti";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_LUNGHI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const COLORI_CONTO = {
  bonifico: "var(--brand)",
  contante: "var(--fg-3)",
  carta: "var(--fg)",
} as const;
const ETICHETTA_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Carta" } as const;
const TIPO_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Carta" } as const;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ em?: string }>;
}) {
  const { em } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const anno = Number(dataOggi.slice(0, 4));
  const mese = Number(dataOggi.slice(5, 7));
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
  const sei = new Date(Date.UTC(anno, mese - 6, 1)).toISOString().slice(0, 10);

  const filtroPrev = [
    isNull(preventivi.deletedAt),
    inArray(preventivi.stato, ["inviato", "in_revisione"]),
  ];
  if (em) filtroPrev.push(eq(preventivi.ragioneSocialeId, em));
  const filtroRate = em ? sql`and r.ragione_sociale_id = ${em}` : sql``;

  const [
    emittenti,
    aperti,
    incassiMese,
    dovuto,
    canoni,
    perMese,
    elencoConti,
    saldi,
    prossime,
    inAttesa,
    scartate,
    daEmettere,
    soll,
    azioni,
  ] = await Promise.all([
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        cliente: clientiRef.nome,
        unaTantum: sql<number>`coalesce((select sum(importo_cent) from preventivo_righe where preventivo_id = ${preventivi.id} and tipo = 'una_tantum'),0)::int`,
        canone: sql<number>`coalesce((select sum(case tipo when 'canone_annuo' then importo_cent when 'canone_mensile' then importo_cent * 12 else 0 end) from preventivo_righe where preventivo_id = ${preventivi.id}),0)::int`,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(and(...filtroPrev))
      .orderBy(preventivi.validoFino),
    db.execute<{ n: number; tot: number }>(
      sql`select count(*)::int n, coalesce(sum(i.importo_cent),0)::int tot from incassi i where i.deleted_at is null and i.data >= ${inizioMese} ${em ? sql`and i.ragione_sociale_id = ${em}` : sql``}`,
    ),
    db.execute<{ tot: number; scaduto: number; n_scaduti: number }>(sql`
        select coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)),0)::int tot,
               coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) filter (where r.stato = 'scaduta'),0)::int scaduto,
               count(*) filter (where r.stato = 'scaduta')::int n_scaduti
        from rate r where r.stato in ('da_incassare','parziale','scaduta') ${filtroRate}`),
    db.execute<{ n: number; anno: number }>(sql`
        select count(*)::int n, coalesce(sum(a.importo_rata_cent * (case a.periodicita when 'mensile' then 12 when 'trimestrale' then 4 when 'semestrale' then 2 else 1 end)),0)::int anno
        from abbonamenti a where a.stato = 'attivo' and a.deleted_at is null ${em ? sql`and a.ragione_sociale_id = ${em}` : sql``}`),
    db.execute<{ ym: string; tipo: keyof typeof COLORI_CONTO; tot: number }>(sql`
        select to_char(i.data,'YYYY-MM') ym, c.tipo, sum(i.importo_cent)::int tot
        from incassi i join conti c on c.id = i.conto_id
        where i.deleted_at is null and i.data >= ${sei} ${em ? sql`and i.ragione_sociale_id = ${em}` : sql``}
        group by 1,2`),
    db.select().from(conti).where(isNull(conti.deletedAt)).orderBy(conti.nome),
    saldiConti(db),
    db
      .select({ r: rate, cliente: clientiRef.nome })
      .from(rate)
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "parziale", "scaduta"]))
      .orderBy(rate.scadenza)
      .limit(4),
    Promise.resolve(null),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from fatture where stato = 'scartata' and deleted_at is null`,
    ),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from fatture where stato = 'bozza' and deleted_at is null`,
    ),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from solleciti where stato = 'da_confermare'`,
    ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(pendingActions)
      .where(eq(pendingActions.stato, "in_attesa")),
  ]);
  void inAttesa;

  // Preventivi aperti: imponibile e ivato
  let apertiNetto = 0;
  let apertiLordo = 0;
  for (const { p } of aperti) {
    apertiNetto += p.imponibileCent;
    apertiLordo += p.totaleCent;
  }
  const liquidita = [...saldi.values()].reduce((a, b) => a + b, 0);

  // Grafico: ultimi 6 mesi, impilato per tipo di conto
  const mesi = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(anno, mese - 1 - (5 - i), 1));
    return { ym: d.toISOString().slice(0, 7), label: MESI[d.getUTCMonth()] ?? "" };
  });
  const valori = mesi.map((m) => {
    const per = { bonifico: 0, contante: 0, carta: 0 };
    for (const r of perMese) if (r.ym === m.ym) per[r.tipo] += r.tot;
    return { ...m, ...per, tot: per.bonifico + per.contante + per.carta };
  });
  const massimo = Math.max(1, ...valori.map((v) => v.tot));

  // Pipeline Twenty
  const opp = await twentyDaEnv()
    .elencaOpportunita()
    .catch(() => []);
  const fasi = new Map<string, { n: number; tot: number }>();
  for (const o of opp) {
    const k = o.fase
      ? o.fase.charAt(0).toUpperCase() + o.fase.slice(1).toLowerCase().replace(/_/g, " ")
      : "Senza fase";
    const x = fasi.get(k) ?? { n: 0, tot: 0 };
    x.n += 1;
    x.tot += o.importoCent ?? 0;
    fasi.set(k, x);
  }
  const maxFase = Math.max(1, ...[...fasi.values()].map((f) => f.tot));

  const daSistemare = [
    {
      n: dovuto[0]?.n_scaduti ?? 0,
      t: "Rate scadute",
      s: "da sollecitare dallo scadenzario",
      href: "/scadenzario",
    },
    {
      n: soll[0]?.n ?? 0,
      t: "Solleciti da confermare",
      s: "nessuno parte senza il tuo ok",
      href: "/scadenzario",
    },
    {
      n: scartate[0]?.n ?? 0,
      t: "Fatture scartate dallo SDI",
      s: "da correggere e reinviare",
      href: "/fatture",
    },
    {
      n: daEmettere[0]?.n ?? 0,
      t: "Fatture in bozza da emettere",
      s: "ricevono il numero all'emissione",
      href: "/fatture",
    },
    {
      n: azioni[0]?.n ?? 0,
      t: "Azioni in attesa di conferma",
      s: "proposte da AI e API",
      href: "/azioni-in-attesa",
    },
  ].filter((x) => x.n > 0);

  const kpi = [
    {
      e: "Preventivi aperti",
      v: formatEuroCompatto(apertiNetto),
      s: `${formatEuro(apertiLordo)} con IVA · ${aperti.length} preventiv${aperti.length === 1 ? "o" : "i"}`,
    },
    {
      e: `Incassato ${MESI_LUNGHI[mese - 1]?.toLowerCase()}`,
      v: formatEuroCompatto(incassiMese[0]?.tot ?? 0),
      s: `${incassiMese[0]?.n ?? 0} moviment${incassiMese[0]?.n === 1 ? "o" : "i"}`,
    },
    {
      e: "Da incassare",
      v: formatEuroCompatto(dovuto[0]?.tot ?? 0),
      link:
        (dovuto[0]?.scaduto ?? 0) > 0
          ? {
              t: `${formatEuroCompatto(dovuto[0]?.scaduto ?? 0)} scaduti`,
              href: "/scadenzario",
              warn: true,
            }
          : { t: "nessuna scaduta", href: "/scadenzario" },
    },
    {
      e: "Canoni ricorrenti",
      v: formatEuroCompatto(canoni[0]?.anno ?? 0),
      per: "/anno",
      link: {
        t: `netto · ${canoni[0]?.n ?? 0} abbonament${canoni[0]?.n === 1 ? "o" : "i"}`,
        href: "/abbonamenti",
      },
    },
    {
      e: "Liquidità",
      v: formatEuroCompatto(liquidita),
      link: { t: "vedi cash flow", href: "/cash-flow" },
    },
  ];

  return (
    <>
      <PageHeader
        titolo={`${MESI_LUNGHI[mese - 1]} ${anno}`}
        descrizione="Come sta andando lo studio, e cosa richiede attenzione oggi."
        azioni={
          <>
            <Button asChild>
              <Link href="/preventivi/nuovo">Nuovo preventivo</Link>
            </Button>
          </>
        }
      />

      <FilterLinks
        etichetta="Filtra per ragione sociale"
        attiva={em ?? ""}
        voci={[
          { id: "", label: "Tutte le ragioni sociali", href: "/" },
          ...emittenti.map((e) => ({ id: e.id, label: e.nome, href: `/?em=${e.id}` })),
        ]}
      />

      <StatsRow
        dati={kpi.map((k) => ({
          etichetta: k.e,
          valore: (
            <>
              {k.v}
              {k.per && <span className="text-sm font-normal text-fg-2">{k.per}</span>}
            </>
          ),
          nota: "s" in k ? k.s : k.link?.t,
          href: "link" in k ? k.link?.href : undefined,
          tono: "link" in k && k.link && "warn" in k.link && k.link.warn ? "bad" : undefined,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Da sistemare oggi" />
          {daSistemare.length === 0 ? (
            <p className="text-sm text-fg-2">Tutto in regola: niente da sistemare.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {daSistemare.map((x) => (
                <li key={x.t}>
                  <Link
                    href={x.href}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-hover"
                  >
                    <Badge variant="warn">{x.n}</Badge>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{x.t}</span>
                      <span className="truncate text-xs text-fg-3">{x.s}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Incassi ultimi 6 mesi"
            action={
              <div className="flex gap-3 text-xs text-fg-2">
                {(["bonifico", "contante", "carta"] as const).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <i className="size-2 rounded-sm" style={{ background: COLORI_CONTO[t] }} />
                    {ETICHETTA_CONTO[t]}
                  </span>
                ))}
              </div>
            }
          />
          <div className="grid h-44 grid-cols-6 items-end gap-3 border-b border-line">
            {valori.map((v, i) => (
              <div key={v.ym} className="flex h-full flex-col justify-end gap-1">
                <span
                  className={`text-center text-xs tabular-nums ${i === 5 ? "font-medium text-fg" : "text-fg-2"}`}
                >
                  {v.tot > 0
                    ? new Intl.NumberFormat("it-IT", { useGrouping: "always" }).format(
                        Math.round(v.tot / 100),
                      )
                    : ""}
                </span>
                {v.tot > 0 && (
                  <div
                    className="flex flex-col overflow-hidden rounded-t-sm"
                    style={{ height: `${Math.max(4, Math.round((v.tot / massimo) * 88))}%` }}
                  >
                    <div style={{ flex: v.carta, background: COLORI_CONTO.carta }} />
                    <div style={{ flex: v.contante, background: COLORI_CONTO.contante }} />
                    <div style={{ flex: v.bonifico, background: COLORI_CONTO.bonifico }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-3 text-center text-xs text-fg-2">
            {mesi.map((m, i) => (
              <span key={m.ym} className={i === 5 ? "font-medium text-fg" : undefined}>
                {m.label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Preventivi in attesa di risposta"
            action={
              <Link href="/preventivi" className="text-sm text-fg-2 hover:text-fg">
                Vedi tutti
              </Link>
            }
          />
          {aperti.length === 0 ? (
            <p className="text-sm text-fg-2">Nessun preventivo in attesa di risposta.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {aperti.slice(0, 5).map(({ p, emittente, cliente, unaTantum, canone }) => {
                const regole = p.snapshot.regole as unknown as RegoleFiscali;
                const ut = prezzoVisualizzato(unaTantum, regole);
                const cn = prezzoVisualizzato(canone, regole);
                const giorni = p.validoFino
                  ? Math.ceil(
                      (new Date(`${p.validoFino}T00:00:00Z`).getTime() -
                        new Date(`${dataOggi}T00:00:00Z`).getTime()) /
                        86400000,
                    )
                  : null;
                const inScadenza = giorni !== null && giorni <= 7;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/preventivi/${p.id}`}
                      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-hover"
                    >
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-sm font-medium">
                          {p.numero ?? "Bozza"} · {cliente ?? "cliente da assegnare"}
                        </span>
                        <span className="truncate text-xs text-fg-3">{emittente}</span>
                      </span>
                      <span className="hidden text-right text-sm tabular-nums sm:block">
                        {unaTantum > 0 ? formatEuro(ut.nettoCent) : "—"}
                        {canone > 0 && (
                          <span className="block text-xs text-fg-3">
                            {formatEuro(cn.nettoCent)}/a
                          </span>
                        )}
                      </span>
                      <Badge variant={inScadenza ? "warn" : "brand"} dot>
                        {inScadenza
                          ? giorni !== null && giorni < 0
                            ? "Scaduto"
                            : `Scade tra ${giorni} gg`
                          : p.stato === "in_revisione"
                            ? "In revisione"
                            : "Inviato"}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Saldi per conto"
            action={
              <Link href="/conti" className="text-sm text-fg-2 hover:text-fg">
                Tutti
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {elencoConti.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">{c.nome}</span>
                  <span className="text-xs text-fg-3">
                    {TIPO_CONTO[c.tipo]}
                    {c.iban ? ` · ••${c.iban.slice(-4)}` : ""}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatEuroCompatto(saldi.get(c.id) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Prossimi incassi"
            action={
              <Link href="/scadenzario" className="text-sm text-fg-2 hover:text-fg">
                Scadenzario
              </Link>
            }
          />
          {prossime.length === 0 ? (
            <p className="text-sm text-fg-2">Nessun incasso in arrivo.</p>
          ) : (
            <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
              {prossime.map(({ r, cliente }) => {
                const scaduta = r.scadenza < dataOggi;
                const [, m, g] = r.scadenza.split("-");
                return (
                  <div key={r.id} className="flex flex-col gap-0.5 bg-surface p-3">
                    <span className={`text-xs font-medium ${scaduta ? "text-bad" : "text-fg-3"}`}>
                      {scaduta ? "Scaduto · " : ""}
                      {Number(g)} {(MESI[Number(m) - 1] ?? "").toLowerCase()}
                    </span>
                    <span className="text-sm font-medium">{cliente ?? "—"}</span>
                    <span className="truncate text-xs text-fg-2">{r.descrizione}</span>
                    <span className="mt-1 text-base font-semibold tabular-nums">
                      {formatEuro(r.importoCent)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Pipeline Twenty" description="Opportunità per fase" />
          {fasi.size === 0 ? (
            <p className="text-sm text-fg-2">Nessuna opportunità da Twenty.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...fasi.entries()].map(([fase, f]) => (
                <div key={fase} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{fase}</span>
                    <span className="text-fg-2 tabular-nums">
                      {f.n} · {formatEuroCompatto(f.tot)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-hover">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(4, Math.round((f.tot / maxFase) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
