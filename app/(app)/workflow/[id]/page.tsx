import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditorWorkflow } from "@/components/workflow/editor";
import type { SchemaWorkflow } from "@/lib/workflow/tipi";

export const dynamic = "force-dynamic";

export default async function ModificaWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const w = await prisma.workflow.findUnique({ where: { id } });
  if (!w) notFound();

  const schema = (w.azioni as unknown as SchemaWorkflow) ?? {
    blocchi: [],
    collegamenti: [],
  };

  return (
    <EditorWorkflow
      iniziale={{
        id: w.id,
        nome: w.nome,
        descrizione: w.descrizione ?? "",
        attivo: w.attivo,
        innesco: w.innesco,
        eventoChiave: w.eventoChiave ?? "",
        blocchi: schema.blocchi ?? [],
        collegamenti: schema.collegamenti ?? [],
      }}
    />
  );
}
