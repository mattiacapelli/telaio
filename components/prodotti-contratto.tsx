"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATI_LICENZA: Record<string, string> = {
  ATTIVA: "Attiva",
  SOSPESA: "Sospesa",
  SCADUTA: "Scaduta",
  DISDETTA: "Disdetta",
};

export function ProdottiContratto({
  contrattoId,
  prodottiCollegati,
  catalogo,
}: {
  contrattoId: string;
  prodottiCollegati: { licenzaId: string; id: string; nome: string; stato: string }[];
  catalogo: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [modifica, setModifica] = useState(false);
  const [selezione, setSelezione] = useState<string[]>(prodottiCollegati.map((p) => p.id));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelezione((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function salva() {
    setErrore(null);
    setSalvando(true);
    const r = await fetch(`/api/contratti/${contrattoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prodottiIds: selezione }),
    }).catch(() => null);
    setSalvando(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setModifica(false);
    router.refresh();
  }

  if (modifica) {
    return (
      <div className="p-4">
        <div className="flex flex-col gap-1 rounded border border-border p-2">
          {catalogo.length === 0 ? (
            <div className="px-1 py-2 text-md text-faint">Nessun prodotto a catalogo.</div>
          ) : (
            catalogo.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-md text-muted">
                <input
                  type="checkbox"
                  checked={selezione.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.nome}
              </label>
            ))
          )}
        </div>
        {errore && (
          <div className="mt-2 rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
            {errore}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" disabled={salvando} onClick={salva}>
            <Check /> {salvando ? "Salvo…" : "Salva"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelezione(prodottiCollegati.map((p) => p.id));
              setModifica(false);
            }}
          >
            <X /> Annulla
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setModifica(true)}>
          <Pencil /> Modifica
        </Button>
      </div>
      <div className="rounded border border-border">
        {prodottiCollegati.length === 0 ? (
          <div className="px-3 py-6 text-center text-md text-faint">
            Nessun prodotto collegato a questo contratto.
          </div>
        ) : (
          prodottiCollegati.map((p) => (
            <Link
              key={p.licenzaId}
              href={`/prodotti/${p.id}`}
              className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
            >
              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
              <Badge tono={p.stato === "ATTIVA" ? "accento" : "neutro"}>
                {STATI_LICENZA[p.stato] ?? p.stato}
              </Badge>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
