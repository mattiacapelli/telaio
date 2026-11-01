"use client";

import { Download, LogOut, Monitor, Moon, Settings, Share, SquarePlus, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { installa, useInstallazione } from "@/lib/installazione";
import { pulisciCache } from "@/lib/pwa";
import { impostaTema, leggiTema, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";

/** Profilo in fondo al menu: nome, impostazioni e uscita. */
export function UserMenu({
  nome,
  email,
  compatto = false,
  lato = "right",
}: {
  nome: string;
  email: string;
  compatto?: boolean;
  lato?: "right" | "bottom";
}) {
  const router = useRouter();
  const { installabile, istruzioniIos } = useInstallazione();
  const [mostraIos, setMostraIos] = useState(false);
  const [tema, setTema] = useState<Tema>("sistema");
  useEffect(() => setTema(leggiTema()), []);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu dell'account"
          className={cn(
            "mt-1 flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150 hover:bg-hover",
            compatto && "justify-center px-0",
          )}
        >
          <Avatar name={nome} size="sm" />
          {!compatto && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-fg">{nome}</span>
              <span className="truncate text-xs text-fg-3">{email}</span>
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={lato} align="end" className="w-56">
          <DropdownMenuLabel>{email}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/impostazioni/sicurezza">
              <Settings /> Profilo e sicurezza
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={tema}
            onValueChange={(v) => {
              setTema(v as Tema);
              impostaTema(v as Tema);
            }}
          >
            <DropdownMenuRadioItem value="sistema">
              <Monitor /> Sistema
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="chiaro">
              <Sun /> Chiaro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="scuro">
              <Moon /> Scuro
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {installabile && (
            <DropdownMenuItem onSelect={() => void installa()}>
              <Download /> Installa applicazione
            </DropdownMenuItem>
          )}
          {istruzioniIos && (
            <DropdownMenuItem onSelect={() => setMostraIos(true)}>
              <Download /> Aggiungi alla schermata Home
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              await authClient.signOut();
              await pulisciCache();
              router.replace("/login");
            }}
          >
            <LogOut /> Esci
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={mostraIos} onOpenChange={setMostraIos}>
        <DialogContent
          size="sm"
          title="Aggiungi Telaio alla schermata Home"
          description="Su iPhone e iPad l'installazione si fa dal menu di condivisione."
          footer={
            <DialogClose asChild>
              <Button variant="secondary">Chiudi</Button>
            </DialogClose>
          }
        >
          <ol className="flex flex-col gap-3 text-sm text-fg">
            <li className="flex items-center gap-2">
              <Share className="size-4 shrink-0 text-fg-2" />
              <span>
                Tocca <b className="font-medium">Condividi</b> nella barra di Safari.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="size-4 shrink-0 text-fg-2" />
              <span>
                Scegli <b className="font-medium">Aggiungi alla schermata Home</b>.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Download className="size-4 shrink-0 text-fg-2" />
              <span>
                Conferma con <b className="font-medium">Aggiungi</b>: Telaio si aprirà come app.
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
