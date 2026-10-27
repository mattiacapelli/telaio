"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import { useFormState } from "./form-modal";

const control =
  "h-[46px] w-full rounded-[14px] border border-ink/16 bg-white/75 px-3.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-ink";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "h-auto min-h-24 py-3", className)} {...props} />;
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
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-[13px] leading-tight font-medium text-ink-2">{label}</span>
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
