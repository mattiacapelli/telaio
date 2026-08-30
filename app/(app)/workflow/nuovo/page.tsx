import { EditorWorkflow } from "@/components/workflow/editor";

export const dynamic = "force-dynamic";

export default function NuovoWorkflowPage() {
  return (
    <EditorWorkflow
      iniziale={{
        nome: "",
        descrizione: "",
        attivo: true,
        innesco: "EVENTO",
        eventoChiave: "preventivo.accettato",
        blocchi: [],
        collegamenti: [],
      }}
    />
  );
}
