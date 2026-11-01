"use client";

import { Fingerprint, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { alInvio } from "./errori";

export interface PasskeyRiga {
  id: string;
  nome: string | null;
  creata: string | null;
  sincronizzata: boolean;
}

/** Passkey (impronta, volto, chiave di sicurezza): accesso senza password. */
export function Passkey({ elenco }: { elenco: PasskeyRiga[] }) {
  const router = useRouter();
  const [supportata, setSupportata] = useState(true);
  const [inCorso, setInCorso] = useState(false);
  const [rinomina, setRinomina] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);

  useEffect(() => setSupportata(typeof window.PublicKeyCredential !== "undefined"), []);

  async function aggiungi(formData: FormData) {
    setInCorso(true);
    const nome = String(formData.get("nome")).trim();
    const { error } = await authClient.passkey.addPasskey(nome ? { name: nome } : undefined);
    setInCorso(false);
    // L'utente che annulla la richiesta del dispositivo non è un errore da segnalare.
    if (error) {
      if (/cancel|abort|not allowed/i.test(error.message ?? "")) return;
      return toast.errore("Passkey non aggiunta", "Il dispositivo ha rifiutato la richiesta.");
    }
    toast("Passkey aggiunta");
    (document.getElementById("form-passkey") as HTMLFormElement | null)?.reset();
    router.refresh();
  }

  async function salvaNome(id: string, formData: FormData) {
    const { error } = await authClient.passkey.updatePasskey({
      id,
      name: String(formData.get("nome")).trim(),
    });
    if (error) return toast.errore("Nome non salvato");
    setRinomina(null);
    router.refresh();
  }

  async function elimina(id: string) {
    const { error } = await authClient.passkey.deletePasskey({ id });
    setDaEliminare(null);
    if (error) return toast.errore("Passkey non eliminata");
    toast("Passkey eliminata");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Passkey"
        description="Accedi con l'impronta, il volto o una chiave di sicurezza, senza digitare la password."
        action={
          <Badge variant={elenco.length ? "ok" : "neutral"} dot>
            {elenco.length ? `${elenco.length} registrate` : "Nessuna"}
          </Badge>
        }
      />
      {elenco.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-md border border-line">
          {elenco.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              {rinomina === p.id ? (
                <form
                  onSubmit={alInvio((f) => salvaNome(p.id, f))}
                  className="flex flex-1 items-center gap-2"
                >
                  <Input name="nome" defaultValue={p.nome ?? ""} autoFocus className="max-w-xs" />
                  <Button type="submit" size="sm">
                    Salva
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRinomina(null)}>
                    Annulla
                  </Button>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 flex-col leading-snug">
                    <span className="truncate font-medium">{p.nome || "Passkey senza nome"}</span>
                    <span className="text-xs text-fg-2">
                      {p.creata
                        ? `Aggiunta il ${new Date(p.creata).toLocaleDateString("it-IT")}`
                        : ""}
                      {p.sincronizzata ? " · sincronizzata sul tuo account del dispositivo" : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {daEliminare === p.id ? (
                      <>
                        <Button size="sm" variant="danger" onClick={() => elimina(p.id)}>
                          Elimina
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDaEliminare(null)}>
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <>
                        <IconButton label="Rinomina" onClick={() => setRinomina(p.id)}>
                          <Pencil />
                        </IconButton>
                        <IconButton label="Elimina" onClick={() => setDaEliminare(p.id)}>
                          <Trash2 />
                        </IconButton>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {supportata ? (
        <form
          id="form-passkey"
          onSubmit={alInvio(aggiungi)}
          className="flex max-w-md items-center gap-2"
        >
          <Input name="nome" placeholder="Nome (es. MacBook, iPhone)" maxLength={60} />
          <Button type="submit" disabled={inCorso} className="shrink-0">
            <Fingerprint /> Aggiungi passkey
          </Button>
        </form>
      ) : (
        <p className="text-sm text-fg-2">Questo browser non supporta le passkey.</p>
      )}
      <p className="mt-3 max-w-prose text-xs text-fg-3">
        Le passkey funzionano solo sull&apos;indirizzo con cui hai aperto Telaio: se lo cambi, vanno
        registrate di nuovo. Tieni sempre un secondo metodo di accesso.
      </p>
    </Card>
  );
}
