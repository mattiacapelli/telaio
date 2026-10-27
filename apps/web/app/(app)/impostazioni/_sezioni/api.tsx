import type { apiKeys, webhooks } from "@telaio/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <p className="eyebrow">API REST</p>
        <p className="mt-2 font-mono text-sm">
          /api/v1 ·{" "}
          <a className="text-blue underline-offset-4 hover:underline" href="/api/v1/openapi">
            /api/v1/openapi
          </a>
        </p>
        <p className="mt-2 text-sm text-muted">
          Autenticazione con <code>Authorization: Bearer tlk_…</code>. 120 richieste al minuto per
          chiave.
        </p>
      </Card>
      <Card>
        <NuovaChiaveApi />
      </Card>
      <Card className="p-2 sm:p-3">
        {chiavi.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted">Nessuna chiave creata.</p>
        )}
        <ul>
          {chiavi.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-2/60 px-3 py-3 last:border-b-0"
            >
              <div>
                <p className="font-medium">{k.nome}</p>
                <p className="font-mono text-xs text-muted">
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <h2 className="h2">Webhook in uscita</h2>
            <span style={{ fontSize: 12, color: "#6b675c" }}>
              consegna firmata, con nuovi tentativi
            </span>
          </div>
          <NuovoWebhook />
          {hook.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                borderTop: "1px solid rgba(23,21,15,.14)",
              }}
            >
              {hook.map(({ w, consegnati, inAttesa, falliti }) => (
                <li
                  key={w.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: "1px solid rgba(23,21,15,.08)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span className="mono" style={{ overflowWrap: "anywhere" }}>
                      {w.url}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <Tag tone={w.attivo ? "green" : "neutral"}>
                        {w.attivo ? "Attivo" : "In pausa"}
                      </Tag>
                      {w.eventi.map((ev) => (
                        <span key={ev} className="tag">
                          {ev}
                        </span>
                      ))}
                    </div>
                    <span className="sub" style={{ marginTop: 0 }}>
                      {consegnati} consegnati · {inAttesa} in attesa · {falliti} falliti
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={impostaWebhook}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="attivo" value={w.attivo ? "false" : "true"} />
                      <Button type="submit" variant="glass" size="sm">
                        {w.attivo ? "Pausa" : "Riattiva"}
                      </Button>
                    </form>
                    <form action={eliminaWebhook}>
                      <input type="hidden" name="id" value={w.id} />
                      <Button type="submit" variant="glass" size="sm">
                        Elimina
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
