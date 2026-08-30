"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncTwenty({ ultimaSync }: { ultimaSync: string | null }) {
  const router = useRouter();
  const [stato, setStato] = useState<"idle" | "corso" | "errore">("idle");
  const [messaggio, setMessaggio] = useState<string | null>(null);

  async function sincronizza() {
    setStato("corso");
    setMessaggio(null);
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const d = await r.json();
      if (!d.ok) {
        setStato("errore");
        setMessaggio(d.errore ?? "sincronizzazione fallita");
        return;
      }
      setStato("idle");
      setMessaggio(`${d.aziende} aziende · ${d.contatti} contatti`);
      router.refresh();
    } catch {
      setStato("errore");
      setMessaggio("impossibile contattare il server");
    }
  }

  const quando = ultimaSync
    ? new Date(ultimaSync).toLocaleString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "mai";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          stato === "errore" ? "bg-neg" : "bg-accent"
        } ${stato === "corso" ? "tl-pulse" : ""}`}
      />
      <span className="text-xs text-muted">
        {stato === "errore"
          ? `Sincronizzazione non riuscita: ${messaggio}`
          : messaggio
            ? `Sincronizzato · ${messaggio}`
            : `Sincronizzato da Twenty · ${quando}`}
      </span>
      <button
        onClick={sincronizza}
        disabled={stato === "corso"}
        className="h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-xs text-muted transition-colors hover:bg-[var(--alpha-light)] hover:text-text disabled:opacity-50"
      >
        {stato === "corso" ? "Sincronizzo…" : "Sincronizza ora"}
      </button>
    </div>
  );
}
