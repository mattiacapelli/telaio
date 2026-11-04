"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { salvaTicketAzione } from "../actions";

/** Impostazioni dei ticket: per ora l'assegnazione automatica dei ticket nuovi. */
export function SezioneTicket({ autoAssegna: iniziale }: { autoAssegna: boolean }) {
  const [autoAssegna, setAutoAssegna] = useState(iniziale);
  const [pending, avvia] = useTransition();
  return (
    <Card>
      <CardHeader title="Assegnazione" description="Chi si occupa di un ticket appena creato." />
      <div className="flex items-start justify-between gap-4">
        <div className="flex max-w-prose flex-col leading-snug">
          <span className="text-sm font-medium">Assegna i nuovi ticket a me</span>
          <span className="text-sm text-fg-2">
            I ticket creati dalla lavagna con il solo titolo vanno subito a te, e nella finestra di
            creazione completa «Assegnato a» parte già da te (puoi sempre cambiarlo o lasciarlo
            vuoto).
          </span>
        </div>
        <Switch
          label="Assegna i nuovi ticket a me"
          checked={autoAssegna}
          disabled={pending}
          onCheckedChange={(valore) => {
            const prima = autoAssegna;
            setAutoAssegna(valore);
            avvia(async () => {
              const r = await salvaTicketAzione(valore);
              if (r.ok)
                toast(
                  valore ? "Assegnazione automatica attiva" : "Assegnazione automatica disattivata",
                );
              else {
                setAutoAssegna(prima);
                toast.errore(r.message ?? "Salvataggio non riuscito");
              }
            });
          }}
        />
      </div>
    </Card>
  );
}
