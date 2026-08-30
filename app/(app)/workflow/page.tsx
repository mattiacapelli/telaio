import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Vuoto } from "@/components/ui-legacy";
import { dataEstesa } from "@/lib/format";
import { Plus, Workflow as IconaWorkflow } from "lucide-react";
import { EVENTI, FREQUENZE } from "@/lib/workflow/tipi";

export const dynamic = "force-dynamic";

const INNESCHI: Record<string, string> = {
  EVENTO: "Evento",
  PIANIFICATO: "Pianificato",
  MANUALE: "Manuale",
};

function etichettaInnesco(innesco: string, chiave: string | null) {
  if (!chiave) return INNESCHI[innesco] ?? innesco;
  const fonte = innesco === "EVENTO" ? EVENTI : FREQUENZE;
  return fonte.find((x) => x.valore === chiave)?.etichetta ?? chiave;
}

export default async function WorkflowPage() {
  const workflow = await prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
    include: { registri: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">
          {workflow.length} workflow · {workflow.filter((w) => w.attivo).length} attivi
        </span>
        <div className="flex-1" />
        <Button size="sm" asChild>
          <Link href="/workflow/nuovo">
            <Plus /> Nuovo workflow
          </Link>
        </Button>
      </div>

      {workflow.length === 0 ? (
        <Vuoto
          titolo="Nessun workflow"
          nota="Le automazioni reagiscono a ciò che succede in Telaio: un preventivo accettato che apre un progetto, una fattura scaduta che genera un promemoria."
        />
      ) : (
        <Card>
          {workflow.map((w) => {
            const ultimo = w.registri[0];
            return (
              <Link
                key={w.id}
                href={`/workflow/${w.id}`}
                className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-[var(--alpha-lighter)]"
              >
                <IconaWorkflow size={14} className="flex-none text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{w.nome}</span>
                    {!w.attivo && <Badge>disattivo</Badge>}
                  </div>
                  <div className="truncate text-xxs text-faint">
                    {etichettaInnesco(w.innesco, w.eventoChiave)}
                    {w.esecuzioni > 0 && ` · ${w.esecuzioni} esecuzioni`}
                    {w.ultimaEsecuzione && ` · ultima ${dataEstesa(w.ultimaEsecuzione)}`}
                  </div>
                </div>
                {ultimo && (
                  <span className="max-w-[240px] truncate text-xxs text-faint">
                    {ultimo.esito}
                  </span>
                )}
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
