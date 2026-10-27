"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** Interruttore a pillola. Con `name` invia "on" nel form quando attivo. */
export function Switch({
  className,
  label,
  ...props
}: SwitchPrimitive.SwitchProps & { label: string }) {
  return (
    <SwitchPrimitive.Root
      aria-label={label}
      className={cn(
        "relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-grey-2 transition-colors data-[state=checked]:bg-ink",
        "after:absolute after:-inset-2 after:content-['']", // area tattile da 44px
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
