"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FormLogin({ da }: { da?: string }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);

    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const d = await r.json();

      if (!d.ok) {
        setErrore(d.errore ?? "Accesso non riuscito");
        setInCorso(false);
        return;
      }

      // refresh() rilegge il layout lato server con la nuova sessione.
      router.replace(da || "/");
      router.refresh();
    } catch {
      setErrore("Impossibile contattare il server");
      setInCorso(false);
    }
  }

  return (
    <form
      onSubmit={invia}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text outline-none focus:border-accent-line"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text outline-none focus:border-accent-line"
        />
      </div>

      {errore && (
        <div
          role="alert"
          className="rounded-lg border border-border2 bg-surface3 px-3 py-2 text-xs"
        >
          {errore}
        </div>
      )}

      <button
        type="submit"
        disabled={inCorso}
        className="mt-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {inCorso ? "Accesso in corso…" : "Accedi"}
      </button>
    </form>
  );
}
