import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "@/lib/utils";

type Variante = "primary" | "secondary" | "ghost" | "danger" | "glass";
type Misura = "sm" | "md" | "default" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `glass` è un alias di `secondary`, mantenuto per le pagine non ancora migrate */
  variant?: Variante | null;
  size?: Misura | null;
  asChild?: boolean;
}

const VARIANTI: Record<Exclude<Variante, "glass">, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-fg hover:bg-hover",
  ghost: "text-fg-2 hover:bg-hover hover:text-fg",
  danger: "bg-bad text-white hover:opacity-90",
};
const MISURE: Record<Misura, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-sm max-md:h-[38px]",
  md: "h-8 gap-1.5 px-3 text-sm max-md:h-[42px]",
  default: "h-8 gap-1.5 px-3 text-sm max-md:h-[42px]",
  icon: "size-8 p-0 max-md:size-[42px]",
};

/** Classi di un bottone, per usarle su un link o su un altro elemento. */
export function buttonVariants({ variant, size }: Pick<ButtonProps, "variant" | "size"> = {}) {
  const v =
    variant === "glass" || !variant ? (variant === "glass" ? "secondary" : "primary") : variant;
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTI[v],
    MISURE[size ?? "md"],
  );
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Bottone quadrato con la sola icona: l'etichetta accessibile è obbligatoria. */
export function IconButton({
  label,
  variant = "ghost",
  className,
  ...props
}: Omit<ButtonProps, "size" | "aria-label"> & { label: string }) {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    />
  );
}
