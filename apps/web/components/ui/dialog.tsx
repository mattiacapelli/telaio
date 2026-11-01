"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const MISURE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

function Overlay() {
  return (
    <D.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
  );
}

function Intestazione({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <D.Title className="text-base font-semibold text-fg">{title}</D.Title>
        <D.Description className={description ? "mt-0.5 text-sm text-fg-2" : "sr-only"}>
          {description ?? title}
        </D.Description>
      </div>
      <D.Close asChild>
        <IconButton label="Chiudi" className="-mt-1 -mr-2">
          <X />
        </IconButton>
      </D.Close>
    </div>
  );
}

/** Modale centrata: corpo scorrevole, piè di pagina per le azioni. */
export function DialogContent({
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}: {
  title: string;
  description?: string;
  size?: keyof typeof MISURE;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <Overlay />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:py-[10vh]">
        <D.Content
          className={cn(
            "pointer-events-auto w-full rounded-lg border border-line bg-surface shadow-pop data-[state=open]:animate-[pop-in_150ms_ease-out]",
            MISURE[size],
            className,
          )}
        >
          <Intestazione title={title} description={description} />
          <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
              {footer}
            </div>
          )}
        </D.Content>
      </div>
    </D.Portal>
  );
}

/** Pannello laterale per dettagli e modifiche rapide (a destra, o a sinistra per il menu mobile). */
export function DrawerContent({
  title,
  description,
  footer,
  children,
  className,
  lato = "destra",
  senzaIntestazione = false,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  lato?: "destra" | "sinistra";
  /** nasconde l'intestazione visibile (il titolo resta per i lettori di schermo) */
  senzaIntestazione?: boolean;
}) {
  const sinistra = lato === "sinistra";
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-md flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-pop",
          sinistra
            ? "left-0 max-w-72 border-r border-line data-[state=open]:animate-[slide-in-left_180ms_ease-out]"
            : "right-0 border-l border-line data-[state=open]:animate-[slide-in-right_180ms_ease-out]",
          className,
        )}
      >
        {senzaIntestazione ? (
          <>
            <D.Title className="sr-only">{title}</D.Title>
            <D.Description className="sr-only">{description ?? title}</D.Description>
          </>
        ) : (
          <Intestazione title={title} description={description} />
        )}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
            {footer}
          </div>
        )}
      </D.Content>
    </D.Portal>
  );
}
