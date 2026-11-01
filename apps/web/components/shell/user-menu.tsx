"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { pulisciCache } from "@/lib/pwa";
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
  return (
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
  );
}
