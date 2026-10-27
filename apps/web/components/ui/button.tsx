import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = .bp, glass e ghost = .bg (aggiungi la classe `bare` per toglierne il bordo), danger = .bp arancio */
  variant?: "primary" | "ghost" | "glass" | "danger" | null;
  size?: "default" | "sm" | "icon" | null;
  asChild?: boolean;
}

export function buttonVariants({
  variant,
  size,
}: Pick<ButtonProps, "variant" | "size"> = {}): string {
  return cn(
    variant === "glass" || variant === "ghost" ? "bg" : "bp",
    size === "sm" && "sm",
    size === "icon" && "!w-11 !px-0",
  );
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const stile =
    variant === "danger" ? { background: "#b4532a", borderColor: "#b4532a" } : undefined;
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      style={{ ...stile, ...props.style }}
      {...props}
    />
  );
}
