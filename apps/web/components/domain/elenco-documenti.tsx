import { ETICHETTE_CATEGORIA_DOCUMENTO, formattaDimensione } from "@telaio/core";
import { Download, Eye, FileText, Image as Immagine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ANTEPRIMA_SICURA } from "@/lib/archivio/richiesta";
import { formatData } from "@/lib/date";
import { EliminaDocumento } from "./elimina-documento";

export interface DocumentoRiga {
  id: string;
  nome: string;
  dimensioneByte: number;
  tipoMime: string;
  categoria: keyof typeof ETICHETTE_CATEGORIA_DOCUMENTO;
  descrizione: string | null;
  caricatoDa: string | null;
  createdAt: Date;
  /** codice del ticket a cui è allegato, se c'è */
  ticket?: string | null;
}

/** I documenti di un progetto o di un ticket: scarica, anteprima dei tipi sicuri, elimina. */
export function ElencoDocumenti({ documenti }: { documenti: DocumentoRiga[] }) {
  return (
    <ul className="divide-y divide-line">
      {documenti.map((d) => {
        const Icona = d.tipoMime.startsWith("image/") ? Immagine : FileText;
        return (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-2">
              <Icona className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{d.nome}</span>
                <Badge>{ETICHETTE_CATEGORIA_DOCUMENTO[d.categoria]}</Badge>
                {d.ticket && <Badge variant="brand">{d.ticket}</Badge>}
              </span>
              {d.descrizione && <span className="text-sm text-fg-2">{d.descrizione}</span>}
              <span className="text-xs text-fg-3">
                {formattaDimensione(d.dimensioneByte)} · {formatData(d.createdAt.toISOString())}
                {d.caricatoDa ? ` · ${d.caricatoDa}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {ANTEPRIMA_SICURA.test(d.tipoMime) && (
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={`/api/documenti/${d.id}?anteprima=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Anteprima di ${d.nome}`}
                  >
                    <Eye />
                  </a>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon">
                <a href={`/api/documenti/${d.id}`} aria-label={`Scarica ${d.nome}`}>
                  <Download />
                </a>
              </Button>
              <EliminaDocumento id={d.id} nome={d.nome} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
