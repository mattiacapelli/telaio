"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useActionState, useContext, useEffect, useState } from "react";
import { Button, type ButtonProps } from "./button";

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
 * e ritorna ActionState; a successo la modale si chiude.
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
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {trigger}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{
            background: "rgba(23,21,15,.42)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        />
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          style={{ padding: "clamp(16px,6vh,64px) 16px" }}
        >
          <Dialog.Content className="dlg pointer-events-auto">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Dialog.Title className="h2">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Chiudi"
                  className="icon"
                  style={{ width: 40, height: 40, background: "#fff", fontSize: 20 }}
                >
                  ×
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description
              className={description ? undefined : "sr-only"}
              style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#3a372f" }}
            >
              {description ?? title}
            </Dialog.Description>
            <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FormStateContext.Provider value={state}>{children}</FormStateContext.Provider>
              {state.message && !state.ok && (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    padding: "12px 16px",
                    borderRadius: 14,
                    background: "#17150f",
                    color: "#f4f3f0",
                    fontSize: 14,
                  }}
                >
                  {state.message}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                <Dialog.Close asChild>
                  <Button type="button" variant="glass">
                    Annulla
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvataggio…" : submitLabel}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
