import type { apiKeys, webhooks } from "@telaio/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { eliminaWebhook, impostaWebhook, revocaChiaveApi } from "../actions";
import { NuovaChiaveApi } from "./chiavi-api";
import { NuovoWebhook } from "./nuovo-webhook";

export function SezioneApi({
  chiavi,
  hook,
}: {
  chiavi: (typeof apiKeys.$inferSelect)[];
  hook: {
    w: typeof webhooks.$inferSelect;
    consegnati: number;
    inAttesa: number;
    falliti: number;
  }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-xs font-medium text-fg-3">API REST</p>
        <p className="mt-2 font-mono text-sm">
          /api/v1 ·{" "}
          <a className="text-brand underline-offset-4 hover:underline" href="/api/v1/openapi">
            /api/v1/openapi
          </a>
        </p>
        <p className="mt-2 text-sm text-fg-2">
          Autenticazione con <code>Authorization: Bearer tlk_…</code>. 120 richieste al minuto per
          chiave.
        </p>
      </Card>
      <Card>
        <NuovaChiaveApi />
      </Card>
      <Card className="p-2 sm:p-3">
        {chiavi.length === 0 && (
          <p className="px-3 py-4 text-sm text-fg-2">Nessuna chiave creata.</p>
        )}
        <ul>
          {chiavi.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-b-0"
            >
              <div>
                <p className="font-medium">{k.nome}</p>
                <p className="font-mono text-xs text-fg-2">
                  {k.prefisso}… · ultimo uso{" "}
                  {k.lastUsedAt ? k.lastUsedAt.toLocaleString("it-IT") : "mai"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone={k.permessi === "lettura" ? "blue" : "orange"}>
                    {k.permessi === "lettura" ? "Sola lettura" : "Lettura e scrittura"}
                  </Tag>
                  {k.scopes.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                  {k.revokedAt && <Tag tone="ink">Revocata</Tag>}
                </div>
              </div>
              {!k.revokedAt && (
                <form action={revocaChiaveApi}>
                  <input type="hidden" name="id" value={k.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Revoca
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Webhook in uscita" description="Consegna firmata, con nuovi tentativi" />
        <NuovoWebhook />
        {hook.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {hook.map(({ w, consegnati, inAttesa, falliti }) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-mono text-xs break-all">{w.url}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Tag tone={w.attivo ? "green" : "neutral"}>
                      {w.attivo ? "Attivo" : "In pausa"}
                    </Tag>
                    {w.eventi.map((ev) => (
                      <Badge key={ev}>{ev}</Badge>
                    ))}
                  </div>
                  <span className="text-xs text-fg-2">
                    {consegnati} consegnati · {inAttesa} in attesa · {falliti} falliti
                  </span>
                </div>
                <div className="flex gap-2">
                  <form action={impostaWebhook}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="attivo" value={w.attivo ? "false" : "true"} />
                    <Button type="submit" variant="secondary" size="sm">
                      {w.attivo ? "Pausa" : "Riattiva"}
                    </Button>
                  </form>
                  <form action={eliminaWebhook}>
                    <input type="hidden" name="id" value={w.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      Elimina
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
