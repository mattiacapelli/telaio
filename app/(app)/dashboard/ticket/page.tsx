import Link from "next/link";
import { getTicket } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/chip";
import { eur, ore, daGiorni } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · Ticket") };
}

const APERTI = ["APERTO", "IN_LAVORAZIONE", "ATTESA_CLIENTE"];

const PRIORITA: Record<string, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const PRIORITA_ORDINE = ["URGENTE", "ALTA", "MEDIA", "BASSA"] as const;

export default async function DashboardTicketPage() {
  const ticket = await getTicket();

  if (ticket.length === 0) {
    return <Vuoto titolo="Nessun ticket" nota="Il carico di assistenza comparirà qui." />;
  }

  const aperti = ticket.filter((t) => APERTI.includes(t.stato));
  const daFatturare = ticket.reduce((s, t) => s + t.daFatturare, 0);
  const alertaAperti = aperti.filter((t) => t.priorita === "ALTA" || t.priorita === "URGENTE");
  const fuoriContratto = ticket.filter((t) => !t.conContratto && APERTI.includes(t.stato));

  const perPriorita = PRIORITA_ORDINE.map((p) => ({
    priorita: p,
    conteggio: aperti.filter((t) => t.priorita === p).length,
  }));
  const maxPriorita = Math.max(...perPriorita.map((p) => p.conteggio), 1);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etichetta="Ticket aperti" valore={String(aperti.length)} nota={`su ${ticket.length} totali`} />
        <Stat etichetta="Ore da fatturare" valore={ore(daFatturare)} nota={`≈ ${eur(daFatturare * 65)}`} />
        <Stat
          etichetta="Alta priorità aperti"
          valore={String(alertaAperti.length)}
          nota={alertaAperti.length > 0 ? "richiede attenzione" : "nessuno"}
        />
        <Stat etichetta="Fuori contratto aperti" valore={String(fuoriContratto.length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHead titolo="Aperti per priorità" />
          <div className="flex flex-col gap-2 p-3">
            {perPriorita.map((p) => (
              <div key={p.priorita} className="flex items-center gap-2 text-md">
                <span className="w-20 flex-none text-muted">{PRIORITA[p.priorita]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(p.conteggio / maxPriorita) * 100}%` }}
                  />
                </div>
                <span className="w-8 flex-none text-right text-xs text-faint">{p.conteggio}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead
            titolo="Alta priorità aperti"
            extra={<Link href="/ticket" className="text-xs text-muted hover:text-text">Tutti</Link>}
          />
          {alertaAperti.length === 0 ? (
            <div className="px-3 py-6 text-center text-md text-faint">Nessun ticket ad alta priorità aperto.</div>
          ) : (
            <div>
              {alertaAperti.map((t) => (
                <Link
                  key={t.id}
                  href={`/ticket/${t.id}`}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <span className="text-xs text-faint">#{t.numero}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-md">{t.titolo}</div>
                    <div className="flex items-center gap-1 text-xs text-faint">
                      <Chip testo={t.cliente} />
                      {t.cliente} · aperto {daGiorni(t.apertoIl)} gg
                    </div>
                  </div>
                  <Badge tono="attenzione">{PRIORITA[t.priorita]}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
