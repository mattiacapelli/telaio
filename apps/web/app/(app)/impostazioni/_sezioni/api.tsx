import type { apiKeys } from "@telaio/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { revocaChiaveApi } from "../actions";
import { NuovaChiaveApi } from "./chiavi-api";

export function SezioneApi({ chiavi }: { chiavi: (typeof apiKeys.$inferSelect)[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="eyebrow">API REST</p>
        <p className="mt-2 font-mono text-sm">/api/v1 · <a className="text-blue underline-offset-4 hover:underline" href="/api/v1/openapi">/api/v1/openapi</a></p>
        <p className="mt-2 text-sm text-muted">Autenticazione con <code>Authorization: Bearer tlk_…</code>. 120 richieste al minuto per chiave.</p>
      </Card>
      <Card><NuovaChiaveApi /></Card>
      <Card className="p-2 sm:p-3">
        {chiavi.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nessuna chiave creata.</p>}
        <ul>
          {chiavi.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-2/60 px-3 py-3 last:border-b-0">
              <div>
                <p className="font-medium">{k.nome}</p>
                <p className="font-mono text-xs text-muted">{k.prefisso}… · ultimo uso {k.lastUsedAt ? k.lastUsedAt.toLocaleString("it-IT") : "mai"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone={k.permessi === "lettura" ? "blue" : "orange"}>{k.permessi === "lettura" ? "Sola lettura" : "Lettura e scrittura"}</Tag>
                  {k.scopes.map((s) => <Tag key={s}>{s}</Tag>)}
                  {k.revokedAt && <Tag tone="ink">Revocata</Tag>}
                </div>
              </div>
              {!k.revokedAt && (
                <form action={revocaChiaveApi}>
                  <input type="hidden" name="id" value={k.id} />
                  <Button type="submit" variant="ghost" size="sm">Revoca</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="eyebrow">Webhook in uscita</p>
        <p className="mt-2 text-sm text-muted">
          Eventi previsti: <code>preventivo.accettato</code>, <code>incasso.registrato</code>, <code>rata.scaduta</code>, <code>fattura.scartata</code>. Firma HMAC e nuovi tentativi li gestisce il worker.
          La configurazione dei webhook dall'interfaccia è ancora da implementare.
        </p>
      </Card>
    </div>
  );
}
