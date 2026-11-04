"use client";

import { Trash2 } from "lucide-react";
import { eliminaDocumentoAction } from "@/app/(app)/progetti/documenti-actions";
import { FormModal } from "@/components/ui/form-modal";

export function EliminaDocumento({ id, nome }: { id: string; nome: string }) {
  return (
    <FormModal
      trigger={<Trash2 aria-label={`Elimina ${nome}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Elimina documento"
      description={`Vuoi eliminare «${nome}»? Il file viene rimosso dall'archivio e non si può recuperare.`}
      submitLabel="Elimina"
      action={eliminaDocumentoAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}
