import Link from "next/link";
import { getClienti } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { Building2, User, FolderKanban, Clock, Receipt } from "lucide-react";
import { eur, eurCent } from "@/lib/format";
import { SyncTwenty } from "@/components/sync-twenty";

export const dynamic = "force-dynamic";

export default async function ClientiPage() {
  const clienti = await getClienti();
  const ultimaSync = clienti.find((c) => c.syncedAt)?.syncedAt ?? null;

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
        <SyncTwenty ultimaSync={ultimaSync ? String(ultimaSync) : null} />
        <div className="flex-1" />
        <span className="text-xs text-faint">
          Sola lettura · l&apos;anagrafica si modifica nel CRM
        </span>
      </div>

      {clienti.length === 0 ? (
        <Vuoto
          titolo="Nessun cliente"
          nota="Sincronizza da Twenty per importare le aziende del tuo workspace."
        />
      ) : (
        <Card>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border px-3 py-2 text-xxs font-medium text-faint">
            <span className="flex items-center gap-1.5"><Building2 size={13} /> Cliente</span>
            <span className="flex items-center gap-1.5"><User size={13} /> Referente</span>
            <span className="flex items-center gap-1.5"><FolderKanban size={13} /> Progetti</span>
            <span className="flex items-center gap-1.5"><Clock size={13} /> Tariffa</span>
            <span className="flex items-center justify-end gap-1.5"><Receipt size={13} /> Fatturato</span>
          </div>
          {clienti.map((c) => (
            <Link
              key={c.id}
              href={`/clienti/${c.id}`}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-surface2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Chip testo={c.ragioneSociale} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">
                    {c.ragioneSociale}
                  </div>
                  <div className="truncate text-xxs text-faint">
                    {[c.settore, c.citta].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted">{c.referente}</span>
              <span className="text-xs text-muted">
                {c.attivi > 0
                  ? `${c.attivi} attiv${c.attivi === 1 ? "o" : "i"}`
                  : c.conclusi > 0
                    ? `${c.conclusi} conclus${c.conclusi === 1 ? "o" : "i"}`
                    : "—"}
              </span>
              <span className="text-xs text-muted">
                {eurCent(c.tariffaOraria)}
              </span>
              <span className="text-right text-xs">
                {c.fatturato > 0 ? eur(c.fatturato) : "—"}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
