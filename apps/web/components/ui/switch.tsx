"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** Interruttore. Con `name` invia "on" nel form quando attivo. */
export function Switch({
  className,
  label,
  ...props
}: SwitchPrimitive.SwitchProps & { label: string }) {
  return (
    <SwitchPrimitive.Root
      aria-label={label}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-150 data-[state=checked]:bg-brand disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-xs transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

/** Aspetto di un interruttore senza comportamento: da mettere dentro un bottone o un link. */
export function InterruttoreVisivo({ attivo }: { attivo: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-5 w-9 rounded-full transition-colors duration-150",
        attivo ? "bg-brand" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-all duration-150",
          attivo ? "left-[18px]" : "left-0.5",
        )}
      />
    </span>
  );
}
