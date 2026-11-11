"use client";

import { Trash2 } from "lucide-react";
import { eliminaDocumentoAction } from "@/app/(app)/allegati-actions";
import { FormModal } from "@/components/ui/form-modal";

export function EliminaDocumento({
  id,
  nome,
  link = false,
}: {
  id: string;
  nome: string;
  link?: boolean;
}) {
  return (
    <FormModal
      trigger={<Trash2 aria-label={`Elimina ${nome}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title={link ? "Elimina link" : "Elimina documento"}
      description={
        link
          ? `Vuoi eliminare il link «${nome}»?`
          : `Vuoi eliminare «${nome}»? Se non è allegato altrove, il file viene rimosso dall'archivio e non si può recuperare.`
      }
      submitLabel="Elimina"
      action={eliminaDocumentoAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}
