"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import { useFormState } from "./form-modal";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("in", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("in", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("in", className)} {...props} />;
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
    <label className={cn("f", className)}>
      <span className="lbl">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span role="alert" className="err">
          {error}
        </span>
      )}
    </label>
  );
}
