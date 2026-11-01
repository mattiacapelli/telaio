"use client";

import { Search } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { useFormState } from "./form-modal";

const CAMPO =
  "w-full rounded-md border border-line bg-surface px-2.5 text-sm text-fg shadow-xs transition-colors duration-150 placeholder:text-fg-3 hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:bg-subtle disabled:text-fg-3";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CAMPO, "h-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CAMPO, "min-h-20 py-1.5", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        CAMPO,
        "h-8 appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8 [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23777' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

/** Campo di ricerca con la lente a sinistra. */
export function SearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3"
      />
      <input type="search" className={cn(CAMPO, "h-8 pl-8")} {...props} />
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 cursor-pointer rounded-sm border-line-strong accent-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  name,
  error: errorProp,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** nome del campo: l'errore si legge dall'esito della modale che lo contiene */
  name?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const state = useFormState();
  const error = errorProp ?? (name ? state.errors?.[name] : undefined);
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-fg-3">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-medium text-bad">
          {error}
        </span>
      )}
    </label>
  );
}
