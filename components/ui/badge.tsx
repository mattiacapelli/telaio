import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-xxs font-medium",
  {
    variants: {
      tono: {
        neutro: "border-border bg-surface2 text-muted",
        accento: "border-accent-line bg-accent-soft text-accent",
        positivo: "border-transparent bg-[var(--pos-soft)] text-pos",
        attenzione: "border-transparent bg-[var(--neg-soft)] text-neg",
      },
    },
    defaultVariants: { tono: "neutro" },
  },
);

export function Badge({
  className,
  tono,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tono }), className)} {...props} />;
}
