"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Selettore dell'emittente: aggiorna il parametro `em` dell'indirizzo. */
export function FiltroEmittente({ emittenti }: { emittenti: { id: string; nome: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#3a372f" }}
    >
      Emittente
      <select
        aria-label="Filtra per emittente"
        value={params.get("em") ?? ""}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          if (e.target.value) p.set("em", e.target.value);
          else p.delete("em");
          router.push(`${pathname}?${p}`);
        }}
        style={{
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          border: "1px solid rgba(23,21,15,.16)",
          background: "rgba(255,255,255,.6)",
          font: "500 13px Inter, sans-serif",
          color: "#17150f",
        }}
      >
        <option value="">Tutte le ragioni sociali</option>
        {emittenti.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
