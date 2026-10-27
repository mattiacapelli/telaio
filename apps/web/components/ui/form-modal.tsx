"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Button, type ButtonProps } from "./button";

export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export const initialState: ActionState = { ok: false };

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
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chiudiamo solo quando arriva un nuovo esito positivo
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-white/80 bg-paper p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-semibold">{title}</Dialog.Title>
              <Dialog.Description className={description ? "mt-1 text-sm text-muted" : "sr-only"}>
                {description ?? title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Chiudi">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <form action={formAction} className="flex flex-col gap-4">
            {typeof children === "function" ? children(state) : children}
            {state.message && !state.ok && (
              <p role="alert" className="rounded-2xl bg-orange/10 px-4 py-3 text-sm text-orange-2">
                {state.message}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Annulla
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvataggio…" : submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
