"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** Interruttore `.sw` del mockup. Con `name` invia "on" nel form quando attivo. */
export function Switch({
  className,
  label,
  checked,
  ...props
}: SwitchPrimitive.SwitchProps & { label: string }) {
  return (
    <SwitchPrimitive.Root
      aria-label={label}
      checked={checked}
      className={cn("sw", className)}
      style={{ background: checked ? "#17150f" : "#c3bfb4" }}
      {...props}
    >
      <SwitchPrimitive.Thumb asChild>
        <span style={{ left: checked ? 21 : 3 }} />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
