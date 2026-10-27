import { richiedeApprovazione, STRUMENTI_MCP } from "@/lib/mcp/registro";
import { st } from "@/lib/utils";
import { impostaApprovazioneMcp, impostaStrumentoMcp } from "../actions";

/** Strumenti MCP: quali sono attivi e quali aspettano la tua approvazione prima di eseguire. */
const GRUPPI = [...new Set(STRUMENTI_MCP.map((s) => s.gruppo))];

export function SezioneMcp({
  attivi,
  approvazioni,
}: {
  attivi: Record<string, boolean>;
  approvazioni: Record<string, boolean>;
}) {
  return (
    <div style={st("display:flex;flex-direction:column;gap:20px")}>
      <div className="card" style={st("display:flex;flex-direction:column;gap:10px")}>
        <h2 className="h2">Endpoint</h2>
        <p className="mono">POST /mcp</p>
        <p className="lead">
          Streamable HTTP, autenticazione con una chiave API che abbia l&apos;ambito{" "}
          <strong>mcp</strong> (creala in API e webhook). Per ogni strumento scegli se può girare
          subito oppure se aspetta la tua conferma in <em>Azioni in attesa</em>: in quel caso
          l&apos;assistente riceve un identificativo e legge l&apos;esito con{" "}
          <code>stato_azione</code>.
        </p>
      </div>
      <div className="card" style={st("display:flex;flex-direction:column;gap:4px")}>
        <div
          style={st(
            "display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 24px;align-items:end;padding-bottom:10px;border-bottom:1px solid rgba(23,21,15,.14)",
          )}
        >
          <span className="eb">Strumento</span>
          <span className="eb">Attivo</span>
          <span className="eb">Approvazione</span>
        </div>
        {GRUPPI.map((g) => (
          <div key={g} style={{ display: "flex", flexDirection: "column" }}>
            <span className="sng" style={{ padding: "18px 0 6px" }}>
              {g}
            </span>
            {STRUMENTI_MCP.filter((x) => x.gruppo === g).map((s) => {
              const attivo = attivi[s.nome] !== false;
              const richiede = richiedeApprovazione(s, approvazioni);
              return (
                <div
                  key={s.nome}
                  style={st(
                    "display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 24px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(23,21,15,.08)",
                  )}
                >
                  <div style={st("display:flex;flex-direction:column;gap:4px;min-width:0")}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {s.nome}
                    </span>
                    <span style={st("font-size:13px;color:#3a372f;line-height:1.5")}>
                      {s.descrizione}
                    </span>
                    <span className="sub" style={{ marginTop: 0 }}>
                      {s.scrittura ? "Scrittura" : "Sola lettura"}
                      {s.scrittura && !richiede ? " · esegue subito, senza conferma" : ""}
                    </span>
                  </div>
                  <form action={impostaStrumentoMcp}>
                    <input type="hidden" name="nome" value={s.nome} />
                    <input type="hidden" name="attivo" value={String(!attivo)} />
                    <button
                      type="submit"
                      className="sw"
                      role="switch"
                      aria-checked={attivo}
                      aria-label={`${s.nome}: ${attivo ? "disattiva" : "attiva"}`}
                      style={{ background: attivo ? "#17150f" : "#c3bfb4" }}
                    >
                      <span style={{ left: attivo ? 21 : 3 }} />
                    </button>
                  </form>
                  <form action={impostaApprovazioneMcp}>
                    <input type="hidden" name="nome" value={s.nome} />
                    <input type="hidden" name="richiede" value={String(!richiede)} />
                    <button
                      type="submit"
                      className={`chip${richiede ? " on" : ""}`}
                      aria-pressed={richiede}
                      disabled={!attivo || !!s.sempreConferma}
                      style={{ opacity: attivo ? 1 : 0.5 }}
                    >
                      {s.sempreConferma
                        ? "Sempre con conferma"
                        : richiede
                          ? "Chiede conferma"
                          : "Esegue subito"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        ))}
        <p style={st("margin:12px 0 0;font-size:13px;color:#6b675c;line-height:1.6")}>
          Predefinito: le scritture chiedono conferma, le letture no. Una chiave con permesso «sola
          lettura» non vede mai gli strumenti di scrittura.
        </p>
      </div>
    </div>
  );
}
