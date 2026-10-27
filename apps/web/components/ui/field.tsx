"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import { useFormState } from "./form-modal";

const control =
  "min-h-11 w-full rounded-2xl border border-grey-2 bg-white/70 px-4 text-sm text-ink placeholder:text-muted focus-visible:border-ink";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "appearance-none pr-8", className)} {...props} />;
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
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs font-medium text-orange-2">
          {error}
        </span>
      )}
    </label>
  );
}
