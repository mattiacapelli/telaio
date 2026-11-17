"use client";

import { Trash2 } from "lucide-react";
import {
  cambiaStatoMonteOreAction,
  eliminaMonteOreAction,
  fatturaOreExtraAction,
} from "@/app/(app)/monte-ore/actions";
import { eliminaTempoAction } from "@/app/(app)/tempo/actions";
import { FormModal } from "@/components/ui/form-modal";

export function EliminaTempo({ id, descrizione }: { id: string; descrizione: string }) {
  return (
    <FormModal
      trigger={<Trash2 aria-label={`Elimina ${descrizione}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Elimina voce di tempo"
      description={`Vuoi eliminare «${descrizione}»? Il saldo del contratto si aggiorna.`}
      submitLabel="Elimina"
      action={eliminaTempoAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}

export function CambiaStatoMonteOre({ id, concluso }: { id: string; concluso: boolean }) {
  return (
    <FormModal
      trigger={concluso ? "Riapri" : "Concludi"}
      triggerVariant="secondary"
      title={concluso ? "Riapri il contratto" : "Concludi il contratto"}
      description={
        concluso
          ? "Tornerà attivo e accetterà di nuovo tempo."
          : "Non accetterà più nuovo tempo. Le voci già registrate restano."
      }
      submitLabel={concluso ? "Riapri" : "Concludi"}
      action={cambiaStatoMonteOreAction}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stato" value={concluso ? "attivo" : "concluso"} />
    </FormModal>
  );
}

export function EliminaMonteOre({ id, nome }: { id: string; nome: string }) {
  return (
    <FormModal
      trigger="Elimina"
      triggerVariant="secondary"
      title="Elimina contratto a ore"
      description={`Vuoi eliminare «${nome}»? Si può solo se non ha tempo registrato.`}
      submitLabel="Elimina"
      action={eliminaMonteOreAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}

export function FatturaOreExtra({
  id,
  ciclo,
  etichetta,
  descrizione,
}: {
  id: string;
  ciclo: number;
  /** testo del pulsante, es. «Fattura 2 h (120,00 €)» */
  etichetta: string;
  descrizione: string;
}) {
  return (
    <FormModal
      trigger={etichetta}
      triggerVariant="secondary"
      triggerSize="sm"
      title="Fattura le ore extra"
      description={descrizione}
      submitLabel="Crea la bozza"
      action={fatturaOreExtraAction}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ciclo" value={ciclo} />
    </FormModal>
  );
}
