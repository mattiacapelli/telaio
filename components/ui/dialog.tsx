"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    titolo: string;
    descrizione?: string;
  }
>(({ className, children, titolo, descrizione, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow)]",
        className,
      )}
      {...props}
    >
      <div className="flex flex-none items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-sm font-semibold">
            {titolo}
          </DialogPrimitive.Title>
          {descrizione && (
            <DialogPrimitive.Description className="mt-0.5 text-md text-muted">
              {descrizione}
            </DialogPrimitive.Description>
          )}
        </div>
        <div className="flex-1" />
        <DialogPrimitive.Close className="grid h-7 w-7 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-surface2 hover:text-text">
          <X size={15} />
          <span className="sr-only">Chiudi</span>
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export { Dialog, DialogTrigger, DialogContent, DialogClose };
