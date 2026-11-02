"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { Button, type ButtonProps } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";
import { toast } from "./toast";

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export const initialState: ActionState = { ok: false };

const FormStateContext = createContext<ActionState>(initialState);

/** Esito dell'ultimo invio della modale che contiene il componente. */
export const useFormState = () => useContext(FormStateContext);

/**
 * Tutti i form di Telaio si aprono in modale. La Server Action riceve (prev, FormData)
 * e ritorna ActionState; a successo la modale si chiude e compare una notifica.
 */
export function FormModal({
  trigger,
  triggerVariant = "primary",
  triggerSize,
  title,
  description,
  submitLabel = "Salva",
  action,
  children,
}: {
  trigger: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title: string;
  description?: string;
  submitLabel?: string;
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pendingAzione] = useActionState(action, initialState);
  const [inTransizione, avvia] = useTransition();
  const pending = pendingAzione || inTransizione;

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast(state.message ?? "Salvato");
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        {/* onSubmit e non action=: con action= React svuota i campi dopo ogni invio, anche in caso
            d'errore, e chi sbaglia un campo perderebbe quello che ha scritto negli altri. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const dati = new FormData(e.currentTarget);
            avvia(() => formAction(dati));
          }}
          className="flex flex-col gap-4"
        >
          <FormStateContext.Provider value={state}>{children}</FormStateContext.Provider>
          {state.message && !state.ok && (
            <p
              role="alert"
              className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
            >
              {state.message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvataggio…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
