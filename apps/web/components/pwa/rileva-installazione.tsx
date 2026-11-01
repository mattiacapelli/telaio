"use client";

import { useEffect } from "react";
import { avviaRilevamentoInstallazione } from "@/lib/installazione";

/** Non mostra nulla: raccoglie gli eventi di installazione fin dal primo caricamento della pagina. */
export function RilevaInstallazione() {
  useEffect(() => avviaRilevamentoInstallazione(), []);
  return null;
}
