import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-[22px] text-sm leading-none font-medium whitespace-nowrap transition-[background-color,color,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink text-paper hover:-translate-y-0.5",
        ghost: "border-transparent bg-transparent text-ink hover:bg-ink hover:text-paper",
        glass: "border-ink/22 bg-white/55 text-ink hover:bg-ink hover:text-paper",
        danger: "border-orange bg-orange text-white hover:bg-orange-2",
      },
      size: { default: "", sm: "min-h-10 px-4 text-[13px]", icon: "w-11 px-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
