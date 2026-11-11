import { ETICHETTE_CATEGORIA_DOCUMENTO, formattaDimensione } from "@telaio/core";
import { Download, ExternalLink, Eye, FileText, Image as Immagine, Link2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ANTEPRIMA_SICURA } from "@/lib/archivio/richiesta";
import { formatData } from "@/lib/date";
import { EliminaDocumento } from "./elimina-documento";

export interface DocumentoRiga {
  id: string;
  tipo: "file" | "link";
  nome: string;
  /** solo file */
  dimensioneByte: number | null;
  tipoMime: string;
  /** solo link */
  url: string | null;
  categoria: keyof typeof ETICHETTE_CATEGORIA_DOCUMENTO;
  descrizione: string | null;
  caricatoDa: string | null;
  createdAt: Date;
  /** codice del ticket a cui è allegato, se c'è */
  ticket?: string | null;
  /** da dove viene (progetto, preventivo…), con il collegamento alla sua pagina */
  origine?: { etichetta: string; href: string } | null;
}

/** Una riga di `allegati` del database, pronta da mostrare. */
export function rigaDocumento(
  d: {
    id: string;
    tipo: "file" | "link";
    nome: string;
    dimensioneByte: number | null;
    tipoMime: string;
    url: string | null;
    categoria: DocumentoRiga["categoria"];
    descrizione: string | null;
    createdAt: Date;
  },
  caricatoDa: string | null,
  extra: Pick<DocumentoRiga, "ticket" | "origine"> = {},
): DocumentoRiga {
  return {
    id: d.id,
    tipo: d.tipo,
    nome: d.nome,
    dimensioneByte: d.dimensioneByte,
    tipoMime: d.tipoMime,
    url: d.url,
    categoria: d.categoria,
    descrizione: d.descrizione,
    caricatoDa,
    createdAt: d.createdAt,
    ...extra,
  };
}

function dominio(url: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** Allegati (file e link): scarica, anteprima dei tipi sicuri, apri il link, elimina. */
export function ElencoDocumenti({ documenti }: { documenti: DocumentoRiga[] }) {
  return (
    <ul className="divide-y divide-line">
      {documenti.map((d) => {
        const link = d.tipo === "link";
        const Icona = link ? Link2 : d.tipoMime.startsWith("image/") ? Immagine : FileText;
        return (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-2">
              <Icona className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                {link && d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                  >
                    {d.nome}
                  </a>
                ) : (
                  <span className="truncate">{d.nome}</span>
                )}
                <Badge>{ETICHETTE_CATEGORIA_DOCUMENTO[d.categoria]}</Badge>
                {link && <Badge variant="brand">Link</Badge>}
                {d.ticket && <Badge variant="brand">{d.ticket}</Badge>}
                {d.origine && (
                  <Link href={d.origine.href} className="inline-flex">
                    <Badge>{d.origine.etichetta}</Badge>
                  </Link>
                )}
              </span>
              {d.descrizione && <span className="text-sm text-fg-2">{d.descrizione}</span>}
              <span className="text-xs text-fg-3">
                {link ? dominio(d.url) : formattaDimensione(d.dimensioneByte ?? 0)} ·{" "}
                {formatData(d.createdAt.toISOString())}
                {d.caricatoDa ? ` · ${d.caricatoDa}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {link && d.url && (
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Apri ${d.nome}`}
                  >
                    <ExternalLink />
                  </a>
                </Button>
              )}
              {!link && ANTEPRIMA_SICURA.test(d.tipoMime) && (
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
              {!link && (
                <Button asChild variant="ghost" size="icon">
                  <a href={`/api/documenti/${d.id}`} aria-label={`Scarica ${d.nome}`}>
                    <Download />
                  </a>
                </Button>
              )}
              <EliminaDocumento id={d.id} nome={d.nome} link={link} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
