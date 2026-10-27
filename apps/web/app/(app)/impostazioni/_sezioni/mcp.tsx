import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { STRUMENTI_MCP } from "@/lib/mcp/registro";
import { impostaStrumentoMcp } from "../actions";

export function SezioneMcp({ attivi }: { attivi: Record<string, boolean> }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="eyebrow">Endpoint</p>
        <p className="mt-2 font-mono text-sm">POST /mcp</p>
        <p className="mt-2 text-sm text-muted">
          Streamable HTTP, autenticazione con una chiave API che abbia l'ambito <strong>mcp</strong>{" "}
          (creala in API e webhook). Le scritture proposte da un'AI non vengono eseguite: finiscono
          in <em>Azioni in attesa</em> e aspettano la tua conferma.
        </p>
      </Card>
      <Card className="p-2 sm:p-3">
        <ul>
          {STRUMENTI_MCP.map((s) => {
            const attivo = attivi[s.nome] !== false;
            return (
              <li
                key={s.nome}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-2/60 px-3 py-3 last:border-b-0"
              >
                <div>
                  <p className="font-mono text-sm font-medium">{s.nome}</p>
                  <p className="text-sm text-muted">{s.descrizione}</p>
                  <div className="mt-2 flex gap-2">
                    <Tag tone={s.scrittura ? "orange" : "blue"}>
                      {s.scrittura ? "Scrittura (con conferma)" : "Sola lettura"}
                    </Tag>
                    {s.stato === "stub" && <Tag>Stub</Tag>}
                  </div>
                </div>
                <form action={impostaStrumentoMcp}>
                  <input type="hidden" name="nome" value={s.nome} />
                  <input type="hidden" name="attivo" value={String(!attivo)} />
                  <Button
                    type="submit"
                    variant={attivo ? "primary" : "ghost"}
                    size="sm"
                    aria-pressed={attivo}
                  >
                    {attivo ? "Attivo" : "Disattivato"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
