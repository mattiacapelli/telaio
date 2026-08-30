import { getImpostazioni } from "@/lib/queries";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eurCent } from "@/lib/format";
import { SyncTwenty } from "@/components/sync-twenty";
import { SchedulerPannello } from "@/components/scheduler-pannello";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Corrisponde alla mappatura mostrata nella schermata Impostazioni del design.
const MAPPATURA = [
  ["Company.name", "Cliente · Ragione sociale"],
  ["Company.piva", "Cliente · P.IVA"],
  ["Company.codiceFiscale", "Cliente · Codice fiscale"],
  ["Company.pec", "Cliente · PEC"],
  ["Company.codiceSdi", "Cliente · Codice SDI"],
  ["Company.settore", "Cliente · Settore"],
  ["Person.name", "Referente · Nome"],
  ["Person.emails", "Referente · Email"],
  ["Company.paymentTerms", "Non mappato"],
];

/** Ultima esecuzione dello scheduler, registrata in Redis. */
async function ultimaEsecuzione() {
  try {
    return await redis.get("telaio:scheduler:ultima");
  } catch {
    return null;
  }
}

export default async function ImpostazioniPage() {
  const [{ imp, clienti, referenti }, ultima] = await Promise.all([
    getImpostazioni(),
    ultimaEsecuzione(),
  ]);
  const configurato = Boolean(process.env.TWENTY_API_KEY);

  return (
    <div className="tl-in grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHead
          titolo="Connessione a Twenty"
          extra={
            <Badge tono={configurato ? "accento" : "neutro"}>
              {configurato ? "Attiva" : "Non configurata"}
            </Badge>
          }
        />
        <div className="flex flex-col gap-3 p-4">
          {!configurato && (
            <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
              Imposta <code className="text-text">TWENTY_API_URL</code> e{" "}
              <code className="text-text">TWENTY_API_KEY</code> nel file{" "}
              <code className="text-text">.env</code> per attivare la
              sincronizzazione.
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["Workspace", imp?.twentyWorkspace ?? "—"],
              [
                "Ultima sincronizzazione",
                imp?.twentySyncedAt
                  ? new Date(imp.twentySyncedAt).toLocaleString("it-IT")
                  : "mai",
              ],
              ["Record importati", `${clienti} aziende · ${referenti} contatti`],
              ["Frequenza", `ogni ${imp?.twentyFrequenza ?? 15} minuti`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-surface2 px-3 py-2">
                <div className="text-xxs text-faint">{k}</div>
                <div className="mt-0.5 text-xs">{v}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold">Mappatura campi</div>
            <div className="rounded-md border border-border">
              {MAPPATURA.map(([da, a]) => (
                <div
                  key={da}
                  className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs last:border-0"
                >
                  <span className="font-mono text-xxs text-muted">{da}</span>
                  <span className="text-faint">→</span>
                  <span className={a === "Non mappato" ? "text-faint" : ""}>{a}</span>
                </div>
              ))}
            </div>
          </div>

          <SyncTwenty
            ultimaSync={imp?.twentySyncedAt ? String(imp.twentySyncedAt) : null}
          />
        </div>
      </Card>

      <Card>
        <CardHead titolo="Attività ricorrenti" />
        <SchedulerPannello
          configurato={Boolean(process.env.SCHEDULER_TOKEN)}
          intervallo={Number(process.env.SCHEDULER_INTERVALLO ?? 3600)}
          ultima={ultima}
        />
      </Card>

      <Card>
        <CardHead titolo="Dati aziendali" />
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {[
            ["Ragione sociale", imp?.ragioneSociale ?? "—"],
            ["P.IVA", imp?.partitaIva ?? "—"],
            ["IBAN", imp?.iban ?? "—"],
            [
              "Tariffa oraria di listino",
              imp ? eurCent(imp.tariffaListino) : "—",
            ],
            ["Termini pagamento", `${imp?.terminiPagamento ?? 30} giorni d.f.`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface2 px-3 py-2">
              <div className="text-xxs text-faint">{k}</div>
              <div className="mt-0.5 truncate text-xs">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
