"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";

export interface SessioneRiga {
  token: string;
  agente: string | null;
  ip: string | null;
  creata: string;
  corrente: boolean;
}

/** Riconoscimento minimo di browser e sistema dallo user agent. */
function descrivi(ua: string | null) {
  if (!ua) return "Dispositivo sconosciuto";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const sistema = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return sistema ? `${browser} su ${sistema}` : browser;
}

/** Dispositivi con cui hai effettuato l'accesso. */
export function Sessioni({ elenco }: { elenco: SessioneRiga[] }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const altre = elenco.filter((s) => !s.corrente);

  async function revoca(token: string) {
    setInCorso(true);
    const { error } = await authClient.revokeSession({ token });
    setInCorso(false);
    if (error) return toast.errore("Sessione non chiusa");
    router.refresh();
  }

  async function revocaTutte() {
    setInCorso(true);
    const { error } = await authClient.revokeOtherSessions();
    setInCorso(false);
    if (error) return toast.errore("Sessioni non chiuse");
    toast("Uscito dagli altri dispositivi");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Dispositivi connessi"
        description="Se ne riconosci uno che non è tuo, chiudilo e cambia la password."
        action={
          altre.length > 0 && (
            <Button variant="secondary" size="sm" onClick={revocaTutte} disabled={inCorso}>
              Esci dagli altri
            </Button>
          )
        }
      />
      <ul className="divide-y divide-line rounded-md border border-line">
        {elenco.map((s) => (
          <li key={s.token} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="flex min-w-0 flex-col leading-snug">
              <span className="flex items-center gap-2 font-medium">
                {descrivi(s.agente)}
                {s.corrente && <Badge variant="brand">Questo dispositivo</Badge>}
              </span>
              <span className="text-xs text-fg-2">
                Accesso del {new Date(s.creata).toLocaleString("it-IT")}
                {s.ip ? ` · ${s.ip}` : ""}
              </span>
            </div>
            {!s.corrente && (
              <Button variant="ghost" size="sm" disabled={inCorso} onClick={() => revoca(s.token)}>
                Chiudi
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
