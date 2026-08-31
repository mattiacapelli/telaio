import Link from "next/link";
import { getDashboard } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { redis } from "@/lib/redis";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, Barra, Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { Scorciatoie } from "@/components/dashboard/scorciatoie";
import { eur, ore, data, daGiorni } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import {
  AlertTriangle, TrendingUp, Clock, Receipt, CircleCheck, LifeBuoy,
  FileText, Flag, ArrowRight, Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard") };
}

const PRIORITA: Record<string, string> = {
  BASSA: "Bassa", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente",
};

const GRAVITA: Record<string, string> = {
  BASSA: "Bassa", MEDIA: "Media", ALTA: "Alta", CRITICA: "Critica",
};

/** Stato del timer, per la scorciatoia "ferma il lavoro". */
async function timerCorrente() {
  try {
    const raw = await redis.get("telaio:timer:corrente");
    if (!raw) return { attivo: false, etichetta: null };
    const s = JSON.parse(raw) as { etichetta?: string | null };
    return { attivo: true, etichetta: s.etichetta ?? null };
  } catch {
    return { attivo: false, etichetta: null };
  }
}

export default async function DashboardPage() {
  const [d, timer] = await Promise.all([getDashboard(), timerCorrente()]);

  if (d.progetti.length === 0 && d.attivita.length === 0 && d.clienti === 0) {
    return (
      <Vuoto
        titolo="Ancora nessun dato"
        nota="Collega Twenty per importare l'anagrafica clienti, oppure crea il primo preventivo."
        azione={
          <div className="flex gap-2">
            <Button size="sm" asChild><Link href="/impostazioni">Collega Twenty</Link></Button>
            <Button size="sm" variant="outline" asChild><Link href="/preventivi">Nuovo preventivo</Link></Button>
          </div>
        }
      />
    );
  }

  const maxOre = Math.max(...d.settimane.map((s) => s.ore), 1);
  const avvisi = [
    d.scaduto > 0 && {
      testo: `${eur(d.scaduto)} di fatture scadute`,
      link: "/fatture",
    },
    d.progettiOltreBudget > 0 && {
      testo: `${d.progettiOltreBudget} progett${d.progettiOltreBudget === 1 ? "o" : "i"} oltre budget`,
      link: "/progetti",
    },
    d.bloccate > 0 && {
      testo: `${d.bloccate} attività bloccat${d.bloccate === 1 ? "a" : "e"}`,
      link: "/attivita",
    },
    d.problemiAperti > 0 && {
      testo: `${d.problemiAperti} criticità apert${d.problemiAperti === 1 ? "a" : "e"}`,
      link: "/progetti",
    },
  ].filter(Boolean) as { testo: string; link: string }[];

  return (
    <div className="tl-in flex flex-col gap-3">
      {/* ------------------------------------------------------ scorciatoie */}
      <div className="flex flex-wrap items-center gap-2">
        <Scorciatoie timerAttivo={timer.attivo} etichettaTimer={timer.etichetta} />
      </div>

      {/* ---------------------------------------------------------- avvisi */}
      {avvisi.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {avvisi.map((a) => (
            <Link
              key={a.testo}
              href={a.link}
              className="flex items-center gap-1.5 rounded border px-2 py-1 text-md transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--neg)",
                background: "var(--neg-soft)",
                color: "var(--neg)",
              }}
            >
              <AlertTriangle size={12} />
              {a.testo}
              <ArrowRight size={11} />
            </Link>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ indicatori */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          etichetta="Ore questa settimana"
          valore={d.oreSettimana.toLocaleString("it-IT", { maximumFractionDigits: 2 })}
          unita="h"
          nota={`${ore(d.oreMese)} nel mese`}
        />
        <Stat
          etichetta="Da fatturare"
          valore={eur(d.valoreDaFatturare)}
          nota={`${ore(d.daFatturare)} non ancora in fattura`}
        />
        <Stat
          etichetta="Da incassare"
          valore={eur(d.daIncassare)}
          nota={d.scaduto > 0 ? `di cui ${eur(d.scaduto)} scaduti` : "nessuno scaduto"}
        />
        <Stat
          etichetta="Incassato nel mese"
          valore={eur(d.incassatoMese)}
          nota={`${eur(d.incassato)} nell'anno`}
        />
        <Stat
          etichetta="In trattativa"
          valore={eur(d.inTrattativa)}
          nota={`${d.preventiviAperti.length} preventivi aperti`}
        />
        <Stat
          etichetta="Progetti attivi"
          valore={String(d.progetti.length)}
          nota={d.progettiOltreBudget > 0 ? `${d.progettiOltreBudget} oltre budget` : "tutti entro budget"}
        />
        <Stat
          etichetta="Attività aperte"
          valore={String(d.attivitaAperte)}
          nota={d.bloccate > 0 ? `${d.bloccate} bloccate` : "nessuna bloccata"}
        />
        <Stat
          etichetta="Ticket aperti"
          valore={String(d.ticketAperti)}
          nota={`${d.clienti} clienti a sistema`}
        />
      </div>

      {/* -------------------------------------------------- prima colonna */}
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHead
              titolo="In scadenza nei prossimi 7 giorni"
              extra={<span className="text-xs text-faint">{d.inScadenza.length}</span>}
            />
            {d.inScadenza.length === 0 ? (
              <div className="px-3 py-5 text-center text-md text-faint">
                Niente in scadenza questa settimana
              </div>
            ) : (
              d.inScadenza.map((s) => {
                const giorni = Math.ceil(
                  (new Date(s.scadenza).getTime() - Date.now()) / 86400000,
                );
                const link =
                  s.tipo === "attivita" ? `/attivita/${s.id}`
                  : s.tipo === "preventivo" ? `/preventivi/${s.id}`
                  : `/progetti/${s.id}`;
                return (
                  <Link
                    key={`${s.tipo}-${s.id}-${s.titolo}`}
                    href={link}
                    className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                  >
                    {s.tipo === "attivita" ? <CircleCheck size={13} className="flex-none text-faint" />
                      : s.tipo === "milestone" ? <Flag size={13} className="flex-none text-faint" />
                      : <FileText size={13} className="flex-none text-faint" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-md">{s.titolo}</div>
                      <div className="truncate text-xs text-faint">{s.contesto}</div>
                    </div>
                    {s.bloccata && <Badge tono="attenzione">bloccata</Badge>}
                    <Badge tono={giorni <= 1 ? "attenzione" : "neutro"}>
                      {giorni < 0 ? `${-giorni} gg fa` : giorni === 0 ? "oggi" : `${giorni} gg`}
                    </Badge>
                  </Link>
                );
              })
            )}
          </Card>

          <Card>
            <CardHead
              titolo="Progetti attivi"
              extra={<Link href="/progetti" className="text-xs text-muted hover:text-text">Tutti</Link>}
            />
            {d.progetti.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/progetti/${p.id}`}
                className="flex flex-col gap-1.5 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-md font-medium">{p.nome}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted">
                    <Chip testo={p.cliente} />
                    <span className="truncate">{p.cliente}</span>
                  </span>
                  <span className={`text-xs ${p.margine < 0 ? "text-neg" : "text-muted"}`}>
                    margine {eur(p.margine)}
                  </span>
                </div>
                <Barra valore={p.oreFatte} max={p.budgetOre} />
                <div className="flex items-center gap-2 text-xs text-faint">
                  <span className={p.oltreBudget ? "text-neg" : undefined}>
                    {ore(p.oreFatte)} / {ore(p.budgetOre)}
                  </span>
                  <div className="flex-1" />
                  {p.consegnaIl && <span>consegna {data(p.consegnaIl)}</span>}
                </div>
              </Link>
            ))}
          </Card>

          <Card className="min-w-0">
            <CardHead titolo="Ore per settimana" extra={<span className="text-xs text-faint">ultime 8</span>} />
            <div className="overflow-x-auto p-3">
              <div className="flex h-20 min-w-[320px] items-end gap-1.5">
                {d.settimane.map((s, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end">
                      <div
                        title={`${s.etichetta}: ${ore(s.ore)}`}
                        className="w-full rounded-t bg-accent"
                        style={{
                          height: `${(s.ore / maxOre) * 100}%`,
                          minHeight: s.ore > 0 ? 3 : 0,
                          opacity: s.ore > 0 ? 1 : 0.15,
                        }}
                      />
                    </div>
                    <span className="text-xs text-faint">{s.etichetta}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------ seconda colonna */}
        <div className="flex flex-col gap-3">
          <Card>
            <CardHead
              titolo="Prossime attività"
              extra={<Link href="/attivita" className="text-xs text-muted hover:text-text">Tutte</Link>}
            />
            {d.attivita.length === 0 ? (
              <div className="px-3 py-5 text-center text-md text-faint">Nessuna attività aperta</div>
            ) : (
              d.attivita.map((a) => (
                <div key={a.id} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/attivita/${a.id}`} className="block truncate text-md hover:underline">
                      {a.titolo}
                    </Link>
                    <div className="truncate text-xs text-faint">
                      {a.progetto}
                      {a.scadenzaIl && ` · ${data(a.scadenzaIl)}`}
                    </div>
                  </div>
                  {a.stato === "IN_CORSO" ? (
                    <Badge tono="accento">in corso</Badge>
                  ) : a.stato === "BLOCCATA" ? (
                    <Badge tono="attenzione">bloccata</Badge>
                  ) : (
                    <AvviaTimer attivitaId={a.id} etichetta={a.titolo} />
                  )}
                </div>
              ))
            )}
          </Card>

          {d.fattureScadute.length > 0 && (
            <Card>
              <CardHead
                titolo="Fatture scadute"
                extra={<Link href="/fatture" className="text-xs text-muted hover:text-text">Tutte</Link>}
              />
              {d.fattureScadute.map((f) => (
                <div key={f.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0">
                  <Receipt size={13} className="flex-none text-neg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{f.numero}</div>
                    <div className="truncate text-xs text-faint">{f.cliente}</div>
                  </div>
                  <Badge tono="attenzione">+{daGiorni(f.scadeIl)} gg</Badge>
                  <span className="font-medium">{eur(f.imponibile)}</span>
                </div>
              ))}
            </Card>
          )}

          {d.ticket.length > 0 && (
            <Card>
              <CardHead
                titolo="Ticket aperti"
                extra={<Link href="/ticket" className="text-xs text-muted hover:text-text">Tutti</Link>}
              />
              {d.ticket.map((t) => (
                <Link
                  key={t.id}
                  href={`/ticket/${t.id}`}
                  className="flex items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <LifeBuoy size={13} className="flex-none text-faint" />
                  <span className="flex-none text-faint">#{t.numero}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{t.titolo}</div>
                    <div className="truncate text-xs text-faint">{t.cliente}</div>
                  </div>
                  <Badge tono={t.priorita === "ALTA" || t.priorita === "URGENTE" ? "attenzione" : "neutro"}>
                    {PRIORITA[t.priorita]}
                  </Badge>
                </Link>
              ))}
            </Card>
          )}

          {d.preventiviAperti.length > 0 && (
            <Card>
              <CardHead
                titolo="Preventivi in attesa"
                extra={<Link href="/preventivi" className="text-xs text-muted hover:text-text">Tutti</Link>}
              />
              {d.preventiviAperti.map((p) => (
                <Link
                  key={p.id}
                  href={`/preventivi/${p.id}`}
                  className="flex items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <FileText size={13} className="flex-none text-faint" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{p.titolo}</div>
                    <div className="truncate text-xs text-faint">
                      {p.numero} · {p.cliente}
                    </div>
                  </div>
                  <Badge>{p.stato === "BOZZA" ? "bozza" : "inviato"}</Badge>
                  <span className="font-medium">{eur(p.imponibile)}</span>
                </Link>
              ))}
            </Card>
          )}

          {d.problemi.length > 0 && (
            <Card>
              <CardHead titolo="Criticità aperte" />
              {d.problemi.map((x, i) => (
                <Link
                  key={`${x.id}-${i}`}
                  href={`/progetti/${x.id}`}
                  className="flex items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <AlertTriangle
                    size={13}
                    className={`flex-none ${x.gravita === "CRITICA" || x.gravita === "ALTA" ? "text-neg" : "text-faint"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{x.titolo}</div>
                    <div className="truncate text-xs text-faint">{x.progetto}</div>
                  </div>
                  <Badge tono={x.gravita === "CRITICA" ? "attenzione" : "neutro"}>
                    {GRAVITA[x.gravita]}
                  </Badge>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
