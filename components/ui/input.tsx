import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-[32px] w-full rounded border border-border bg-surface2 px-2 text-sm text-text outline-none transition-colors placeholder:text-faint focus:border-accent-line focus:ring-1 focus:ring-accent-line disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-[32px] w-full rounded border border-border bg-surface2 px-2 text-sm text-text outline-none transition-colors focus:border-accent-line focus:ring-1 focus:ring-accent-line disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

/** Etichetta + campo, la coppia usata in tutti i form. */
export function Campo({
  etichetta,
  children,
  nota,
}: {
  etichetta: string;
  children: React.ReactNode;
  nota?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{etichetta}</span>
      {children}
      {nota && <span className="text-xxs text-faint">{nota}</span>}
    </label>
  );
}

export { Input, Select };
