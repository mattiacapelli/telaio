"use client";

import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  DrawerContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

export function Interattivo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Apri modale</Button>
          </DialogTrigger>
          <DialogContent
            title="Titolo della modale"
            description="Descrizione breve di cosa si sta facendo."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary">Annulla</Button>
                </DialogClose>
                <Button>Conferma</Button>
              </>
            }
          >
            <p className="text-sm text-fg-2">
              Il corpo scorre se il contenuto è lungo; il piè di pagina resta visibile.
            </p>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Apri pannello</Button>
          </DialogTrigger>
          <DrawerContent
            title="Pannello laterale"
            description="Per dettagli e modifiche rapide."
            footer={<Button>Salva</Button>}
          >
            <p className="text-sm text-fg-2">Contenuto del pannello.</p>
          </DrawerContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Menu a tendina</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Azioni</DropdownMenuLabel>
            <DropdownMenuItem>
              <Pencil /> Modifica
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy /> Duplica
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked>Mostra archiviati</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger>
              <Trash2 /> Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Altre azioni">
          <IconButton label="Altre azioni">
            <MoreHorizontal />
          </IconButton>
        </Tooltip>

        <Button variant="secondary" onClick={() => toast("Preventivo salvato")}>
          Notifica
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.errore("Operazione non riuscita", "Controlla i campi e riprova.")}
        >
          Notifica di errore
        </Button>
      </div>

      <ContextMenu>
        <ContextMenuTrigger className="flex h-20 items-center justify-center rounded-lg border border-dashed border-line-strong text-sm text-fg-2">
          Clic destro qui per il menu contestuale
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            <Plus /> Nuovo
          </ContextMenuItem>
          <ContextMenuItem>
            <Pencil /> Modifica
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem danger>
            <Trash2 /> Elimina
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Panoramica</TabsTrigger>
          <TabsTrigger value="b">Attività</TabsTrigger>
          <TabsTrigger value="c">Impostazioni</TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="text-sm text-fg-2">
          Contenuto della prima scheda.
        </TabsContent>
        <TabsContent value="b" className="text-sm text-fg-2">
          Contenuto della seconda scheda.
        </TabsContent>
        <TabsContent value="c" className="text-sm text-fg-2">
          Contenuto della terza scheda.
        </TabsContent>
      </Tabs>
    </div>
  );
}
