"use client";

import { CATEGORIE_DOCUMENTO, ETICHETTE_CATEGORIA_DOCUMENTO } from "@telaio/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aggiungiLinkAction } from "@/app/(app)/allegati-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { campiDestinazione, type Destinazione } from "./allegati-destinazione";

/** Allega un link (Figma, cartella condivisa, repository…) invece di un file. */
export function AggiungiLink({ destinazione }: { destinazione: Destinazione }) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [titolo, setTitolo] = useState("");
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState("altro");
  const [descrizione, setDescrizione] = useState("");

  function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    const dati = campiDestinazione(destinazione, new FormData());
    dati.set("titolo", titolo);
    dati.set("url", url);
    dati.set("categoria", categoria);
    dati.set("descrizione", descrizione);
    avvia(async () => {
      const esito = await aggiungiLinkAction({ ok: false }, dati);
      if (!esito.ok) {
        setErrore((esito.errors && Object.values(esito.errors)[0]) || esito.message || "Errore");
        return;
      }
      toast(esito.message ?? "Link aggiunto");
      setTitolo("");
      setUrl("");
      setDescrizione("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={invia} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Titolo del link"
          placeholder="Titolo (es. Design su Figma)"
          maxLength={200}
          required
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
        />
        <Input
          aria-label="Indirizzo del link"
          type="url"
          placeholder="https://…"
          maxLength={2000}
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Select
          aria-label="Categoria del link"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          {CATEGORIE_DOCUMENTO.map((c) => (
            <option key={c} value={c}>
              {ETICHETTE_CATEGORIA_DOCUMENTO[c]}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Descrizione del link"
          placeholder="Descrizione (facoltativa)"
          maxLength={500}
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
        />
      </div>
      {errore && (
        <p role="alert" className="text-sm text-bad">
          {errore}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={inCorso}>
          {inCorso ? "Aggiunta…" : "Aggiungi il link"}
        </Button>
      </div>
    </form>
  );
}
