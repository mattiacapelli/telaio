"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AggiungiLink } from "./aggiungi-link";
import type { Destinazione } from "./allegati-destinazione";
import { CaricaDocumenti } from "./carica-documenti";
import { ScegliDaArchivio } from "./scegli-da-archivio";

const SCHEDA = "data-[state=inactive]:hidden";

/** Tre modi di allegare: caricare un file nuovo, prenderne uno già nell'archivio, aggiungere un link. */
export function AllegaDocumenti({
  destinazione,
  configurato,
}: {
  destinazione: Destinazione;
  configurato: boolean;
}) {
  return (
    <Tabs defaultValue="file">
      <TabsList>
        <TabsTrigger value="file">Carica un file</TabsTrigger>
        <TabsTrigger value="archivio">Dall&apos;archivio</TabsTrigger>
        <TabsTrigger value="link">Aggiungi un link</TabsTrigger>
      </TabsList>
      {/* sempre montate: cambiando scheda un caricamento in corso, i file scelti e il testo scritto non si perdono */}
      <TabsContent value="file" forceMount className={SCHEDA}>
        <CaricaDocumenti destinazione={destinazione} configurato={configurato} />
      </TabsContent>
      <TabsContent value="archivio" forceMount className={SCHEDA}>
        <ScegliDaArchivio destinazione={destinazione} />
      </TabsContent>
      <TabsContent value="link" forceMount className={SCHEDA}>
        <AggiungiLink destinazione={destinazione} />
      </TabsContent>
    </Tabs>
  );
}
