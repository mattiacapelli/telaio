import { Card, CardHeader } from "@/components/ui/card";
import { InterruttoreVisivo } from "@/components/ui/switch";
import { richiedeApprovazione, STRUMENTI_MCP } from "@/lib/mcp/registro";
import { cn } from "@/lib/utils";
import { impostaApprovazioneMcp, impostaStrumentoMcp } from "../actions";

const GRUPPI = [...new Set(STRUMENTI_MCP.map((s) => s.gruppo))];

/** Strumenti MCP: quali sono attivi e quali aspettano la tua approvazione prima di eseguire. */
export function SezioneMcp({
  attivi,
  approvazioni,
}: {
  attivi: Record<string, boolean>;
  approvazioni: Record<string, boolean>;
}) {
  return (
    <>
      <Card>
        <CardHeader title="Endpoint" />
        <p className="font-mono text-sm">POST /mcp</p>
        <p className="mt-2 max-w-prose text-sm text-fg-2">
          Streamable HTTP, autenticazione con una chiave API che abbia l&apos;ambito{" "}
          <b className="font-medium text-fg">mcp</b> (creala in API e webhook). Per ogni strumento
          scegli se può girare subito oppure se aspetta la tua conferma in Azioni in attesa:
          l&apos;assistente riceve un identificativo e legge l&apos;esito con{" "}
          <code className="font-mono text-xs">stato_azione</code>.
        </p>
      </Card>
      <Card className="p-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 border-b border-line bg-subtle px-4 py-2 text-xs font-medium text-fg-2">
          <span>Strumento</span>
          <span>Attivo</span>
          <span className="w-36">Approvazione</span>
        </div>
        {GRUPPI.map((g) => (
          <div key={g}>
            <p className="px-4 pt-3 pb-1 text-xs font-medium text-fg-3">{g}</p>
            {STRUMENTI_MCP.filter((x) => x.gruppo === g).map((s) => {
              const attivo = attivi[s.nome] !== false;
              const richiede = richiedeApprovazione(s, approvazioni);
              return (
                <div
                  key={s.nome}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 border-t border-line px-4 py-2.5"
                >
                  <div className="flex min-w-0 flex-col leading-snug">
                    <span className="font-mono text-sm font-medium">{s.nome}</span>
                    <span className="text-xs text-fg-2">{s.descrizione}</span>
                    {s.scrittura && !richiede && (
                      <span className="text-xs text-warn">
                        Scrittura: esegue subito, senza conferma
                      </span>
                    )}
                  </div>
                  <form action={impostaStrumentoMcp}>
                    <input type="hidden" name="nome" value={s.nome} />
                    <input type="hidden" name="attivo" value={String(!attivo)} />
                    <button
                      type="submit"
                      className="cursor-pointer"
                      aria-label={`${s.nome}: ${attivo ? "disattiva" : "attiva"}`}
                    >
                      <InterruttoreVisivo attivo={attivo} />
                    </button>
                  </form>
                  <form action={impostaApprovazioneMcp} className="w-36">
                    <input type="hidden" name="nome" value={s.nome} />
                    <input type="hidden" name="richiede" value={String(!richiede)} />
                    <button
                      type="submit"
                      aria-pressed={richiede}
                      disabled={!attivo || !!s.sempreConferma}
                      className={cn(
                        "h-7 w-full cursor-pointer rounded-md border px-2 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                        richiede
                          ? "border-transparent bg-brand-soft text-brand"
                          : "border-line bg-surface text-fg-2 hover:bg-hover",
                      )}
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
        <p className="border-t border-line px-4 py-3 text-xs text-fg-2">
          Predefinito: le scritture chiedono conferma, le letture no. Una chiave con permesso «sola
          lettura» non vede mai gli strumenti di scrittura.
        </p>
      </Card>
    </>
  );
}
