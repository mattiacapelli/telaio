"use client";

import { useActionState } from "react";
import { EVENTI_WEBHOOK } from "@/lib/eventi-webhook";
import { st } from "@/lib/utils";
import { creaWebhook } from "../actions";

/** Nuovo webhook: il segreto di firma compare una sola volta, subito dopo la creazione. */
export function NuovoWebhook() {
  const [stato, azione, pending] = useActionState(creaWebhook, { ok: false });
  const e = stato.errors ?? {};

  if (stato.ok && stato.secret) {
    return (
      <div className="ink" style={st("display:flex;flex-direction:column;gap:10px")}>
        <span
          style={st(
            "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7)",
          )}
        >
          Copia ora il segreto di firma: non verrà mostrato di nuovo
        </span>
        <code
          className="mono"
          style={st(
            "overflow-x:auto;padding:12px 14px;border-radius:12px;background:rgba(244,243,240,.1)",
          )}
        >
          {stato.secret}
        </code>
        <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
          Ogni consegna ha l&apos;intestazione <code>x-telaio-signature: sha256=…</code>{" "}
          (HMAC-SHA256 del corpo).
        </span>
      </div>
    );
  }

  return (
    <form action={azione} style={st("display:flex;flex-direction:column;gap:14px")}>
      <div className="f">
        <label className="lbl" htmlFor="wh-url">
          Indirizzo che riceve gli eventi
        </label>
        <input
          id="wh-url"
          name="url"
          className="in"
          type="url"
          placeholder="https://esempio.it/telaio/webhook"
          required
        />
        {e.url && (
          <span className="err" role="alert">
            {e.url}
          </span>
        )}
      </div>
      <fieldset
        style={st(
          "border:0;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 16px",
        )}
      >
        <legend className="lbl" style={{ marginBottom: 6 }}>
          Eventi
        </legend>
        {EVENTI_WEBHOOK.map((ev) => (
          <label key={ev.nome} className="ck" style={{ minHeight: 40 }}>
            <input type="checkbox" name="eventi[]" value={ev.nome} />
            <span>
              <span className="mono">{ev.nome}</span>
              <span className="sub" style={{ marginTop: 0 }}>
                {ev.descrizione}
              </span>
            </span>
          </label>
        ))}
        {e.eventi && (
          <span className="err" role="alert">
            {e.eventi}
          </span>
        )}
      </fieldset>
      <div>
        <button type="submit" className="bp sm" disabled={pending}>
          Aggiungi webhook
        </button>
      </div>
    </form>
  );
}
