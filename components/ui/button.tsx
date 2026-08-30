import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Misure prese da twenty-ui/src/input/Button/Button.module.scss:
 * altezza 32px (medium) e 24px (small), padding orizzontale --t-spacing-2 (8px),
 * gap --t-spacing-1 (4px), raggio --t-border-radius-md.
 * L'accento blu usa --t-color-blue (Radix indigo9) con testo gray1.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded border font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-line disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent text-accent-fg hover:bg-[var(--accent-hover)]",
        outline:
          "border-border2 bg-[var(--alpha-lighter)] text-muted hover:bg-[var(--alpha-light)] hover:text-text",
        ghost:
          "border-transparent text-muted hover:bg-surface2 hover:text-text",
        danger: "border-transparent bg-[var(--neg)] text-white hover:opacity-90",
      },
      size: {
        default: "h-[32px] px-2",
        sm: "h-[24px] px-2 text-md",
        icon: "h-[32px] w-[32px] px-0",
        iconSm: "h-[24px] w-[24px] px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
