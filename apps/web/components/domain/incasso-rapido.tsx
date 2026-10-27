"use client";

import { formatEuro } from "@telaio/core";
import Link from "next/link";
import { useState, useTransition } from "react";
import { registraIncassoAction } from "@/app/(app)/incassi/actions";
import { initialState } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";
import { cn, st } from "@/lib/utils";

interface Conto {
  id: string;
  nome: string;
  tipo: "bonifico" | "contante" | "carta";
  ragioneSocialeId: string | null;
}
interface Rata {
  id: string;
  clienteId: string;
  descrizione: string;
  importoCent: number;
  scaduta: boolean;
  ragioneSocialeId: string;
}

const METODI = [
  ["contante", "Contante"],
  ["bonifico", "Bonifico"],
  ["carta", "Carta"],
] as const;
const TASTI = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

/** Registrazione rapida di un incasso da telefono: tastierino, metodo, rata opzionale. */
export function IncassoRapido({
  conti,
  clienti,
  rate,
}: {
  conti: Conto[];
  clienti: { id: string; nome: string }[];
  rate: Rata[];
}) {
  const [clienteId, setClienteId] = useState<string | null>(clienti[0]?.id ?? null);
  const [rataId, setRataId] = useState<string | null>(null);
  const [testo, setTesto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODI)[number][0]>("contante");
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<{ importo: string; conto: string } | null>(null);
  const [pending, avvia] = useTransition();

  const proposta = rate.find((r) => r.clienteId === clienteId);
  const rata = rate.find((r) => r.id === rataId);
  const conto =
    conti.find(
      (c) =>
        c.tipo === metodo &&
        (!rata || !c.ragioneSocialeId || c.ragioneSocialeId === rata.ragioneSocialeId),
    ) ?? conti.find((c) => c.tipo === metodo);
  const importo =
    testo === ""
      ? "0,00"
      : testo.includes(",")
        ? testo.padEnd(testo.indexOf(",") + 3, "0")
        : `${testo},00`;

  function premi(k: string) {
    setErrore(null);
    if (k === "⌫") return setTesto((t) => t.slice(0, -1));
    if (k === ",") return setTesto((t) => (t.includes(",") ? t : `${t || "0"},`));
    setTesto((t) => {
      const [, dec] = t.split(",");
      if (dec !== undefined && dec.length >= 2) return t;
      return t === "0" ? k : t + k;
    });
  }

  function conferma() {
    if (!conto) return setErrore("Nessun conto di questo tipo");
    const fd = new FormData();
    fd.set("contoId", conto.id);
    fd.set("data", oggi());
    fd.set("importo", importo);
    if (rataId) fd.set("rataId", rataId);
    avvia(async () => {
      const r = await registraIncassoAction(initialState, fd);
      if (r.ok) setFatto({ importo, conto: conto.nome });
      else setErrore(r.errors?.importo ?? r.message ?? "Registrazione non riuscita");
    });
  }

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100dvh",
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(420px 320px at 100% 0%, #ddd9cf, transparent 70%), #f4f3f0",
        padding: "22px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={st("display:flex;align-items:center;justify-content:space-between")}>
        <div style={st("display:flex;flex-direction:column;gap:4px")}>
          <span
            style={st(
              "font:500 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6b675c",
            )}
          >
            Incasso al volo
          </span>
          <span className="d" style={st("font-size:22px;font-weight:600;letter-spacing:-.02em")}>
            Nuovo incasso
          </span>
        </div>
        <Link
          href="/incassi"
          aria-label="Chiudi"
          style={st(
            "width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.7);border:1px solid rgba(23,21,15,.12)",
          )}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      {clienti.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Cliente"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            margin: "0 -20px",
            padding: "0 20px 2px",
          }}
        >
          {clienti.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === clienteId}
              className={cn("cc", c.id === clienteId && "on")}
              onClick={() => {
                setClienteId(c.id);
                setRataId(null);
              }}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      {proposta && (
        <div
          style={st(
            "display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.8)",
          )}
        >
          <div style={st("flex:1;display:flex;flex-direction:column;gap:3px")}>
            <span style={st("font-size:13px;font-weight:600")}>
              {proposta.descrizione}
              {proposta.scaduta ? " · scaduta" : ""}
            </span>
            <span style={st("font-size:12px;color:#3a372f")}>
              {formatEuro(proposta.importoCent)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRataId(proposta.id);
              setTesto(
                formatEuro(proposta.importoCent)
                  .replace(/[^\d,]/g, "")
                  .replace(/,00$/, ""),
              );
            }}
            style={st(
              "min-height:40px;padding:0 14px;border-radius:999px;border:0;background:#17150f;color:#f4f3f0;font:500 13px/1 Inter,sans-serif;cursor:pointer",
            )}
          >
            {rataId === proposta.id ? "In uso" : "Usa"}
          </button>
        </div>
      )}

      <div
        style={st("display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0")}
      >
        <span
          className="d"
          style={st(
            "font-size:54px;font-weight:600;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums",
          )}
        >
          € {importo}
        </span>
        <span style={st("font-size:13px;color:#3a372f")}>
          {rata ? `Chiude: ${rata.descrizione}` : "Digita l'importo ricevuto"}
        </span>
      </div>

      <div role="radiogroup" aria-label="Metodo" className="segs">
        {METODI.map(([id, l]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={metodo === id}
            className={cn("seg", metodo === id && "on")}
            onClick={() => setMetodo(id)}
          >
            {l}
          </button>
        ))}
      </div>
      <span style={st("text-align:center;font-size:13px;color:#3a372f;margin-top:-4px")}>
        Va su <b style={{ color: "#17150f" }}>{conto?.nome ?? "—"}</b>
      </span>

      <div
        style={st(
          "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:auto",
        )}
      >
        {TASTI.map((k) => (
          <button
            key={k}
            type="button"
            className="key"
            aria-label={k === "⌫" ? "Cancella" : k}
            onClick={() => premi(k)}
          >
            {k}
          </button>
        ))}
      </div>
      {errore && (
        <p
          role="alert"
          style={st("margin:0;text-align:center;font-size:13px;font-weight:500;color:#8f3f1d")}
        >
          {errore}
        </p>
      )}
      <button
        type="button"
        onClick={conferma}
        disabled={pending || importo === "0,00"}
        style={{
          minHeight: 56,
          borderRadius: 999,
          border: 0,
          background: "#17150f",
          color: "#f4f3f0",
          font: "500 16px/1 Inter,sans-serif",
          cursor: "pointer",
          opacity: pending || importo === "0,00" ? 0.5 : 1,
        }}
      >
        {pending ? "Registro…" : `Registra € ${importo}`}
      </button>

      {fatto && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            background: "#17150f",
            color: "#f4f3f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <span
            style={st(
              "width:72px;height:72px;border-radius:50%;border:1.5px solid rgba(244,243,240,.4);display:grid;place-items:center",
            )}
          >
            <svg
              aria-hidden="true"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f4f3f0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="d" style={st("font-size:34px;font-weight:600;letter-spacing:-.03em")}>
            € {fatto.importo}
          </span>
          <span style={st("font-size:15px;line-height:1.55;color:rgba(244,243,240,.85)")}>
            Registrato su {fatto.conto}
          </span>
          <button
            type="button"
            onClick={() => {
              setFatto(null);
              setTesto("");
              setRataId(null);
            }}
            style={st(
              "margin-top:12px;min-height:50px;padding:0 26px;border-radius:999px;border:0;background:#f4f3f0;color:#17150f;font:500 15px/1 Inter,sans-serif;cursor:pointer",
            )}
          >
            Nuovo incasso
          </button>
          <Link
            href="/incassi"
            style={st(
              "color:rgba(244,243,240,.8);font-size:14px;text-decoration:underline;text-underline-offset:3px",
            )}
          >
            Vai agli incassi
          </Link>
        </div>
      )}
    </div>
  );
}
