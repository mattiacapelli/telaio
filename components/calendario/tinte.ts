import type { Tinta } from "@/components/tile-icona";
import type { EventoCalendario } from "@/lib/queries";

/**
 * Tinta per categoria di evento sulla timeline, distinta dalla palette della
 * sidebar: qui identifica "che tipo di cosa è", non "in che sezione vivo".
 */
export const TINTA_EVENTO: Record<EventoCalendario["tipo"], Tinta> = {
  progetto: "orange",
  attivita: "green",
  milestone: "pink",
  contratto: "purple",
  fattura: "turquoise",
};

export const ETICHETTA_TIPO: Record<EventoCalendario["tipo"], string> = {
  progetto: "Progetti",
  attivita: "Attività",
  milestone: "Milestone",
  contratto: "Contratti",
  fattura: "Fatture",
};
