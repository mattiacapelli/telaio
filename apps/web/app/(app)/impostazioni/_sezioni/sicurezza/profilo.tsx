"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { alInvio, messaggioErrore } from "./errori";

/** Nome e password dell'utente. L'email è l'identità di accesso e non si cambia da qui. */
export function Profilo({
  nome,
  email,
  passwordMinima = 8,
}: {
  nome: string;
  email: string;
  passwordMinima?: number;
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errorePassword, setErrorePassword] = useState<string | null>(null);

  async function salvaNome(formData: FormData) {
    const nuovo = String(formData.get("nome")).trim();
    if (!nuovo || nuovo === nome) return;
    setInCorso(true);
    const { error } = await authClient.updateUser({ name: nuovo });
    setInCorso(false);
    if (error) return toast.errore(messaggioErrore(error, "Nome non salvato"));
    toast("Nome aggiornato");
    router.refresh();
  }

  async function cambiaPassword(formData: FormData) {
    setErrorePassword(null);
    const corrente = String(formData.get("corrente"));
    const nuova = String(formData.get("nuova"));
    if (nuova.length < passwordMinima)
      return setErrorePassword(`La nuova password deve avere almeno ${passwordMinima} caratteri`);
    if (nuova !== String(formData.get("conferma")))
      return setErrorePassword("Le due password nuove non coincidono");
    setInCorso(true);
    const { error } = await authClient.changePassword({
      currentPassword: corrente,
      newPassword: nuova,
      revokeOtherSessions: formData.get("altri") === "on",
    });
    setInCorso(false);
    if (error) return setErrorePassword(messaggioErrore(error, "Password non cambiata"));
    toast("Password cambiata");
    (document.getElementById("form-password") as HTMLFormElement | null)?.reset();
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader title="Profilo" description="Come compari nell'app." />
        <form onSubmit={alInvio(salvaNome)} className="flex max-w-md flex-col gap-3">
          <Field label="Nome">
            <Input name="nome" defaultValue={nome} required autoComplete="name" />
          </Field>
          <Field label="Email">
            <Input value={email} disabled readOnly autoComplete="username" />
          </Field>
          <div>
            <Button type="submit" disabled={inCorso}>
              Salva
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader
          title="Password"
          description="Scegline una lunga e usata solo per Telaio. Con una passkey puoi anche non digitarla."
        />
        <form
          id="form-password"
          onSubmit={alInvio(cambiaPassword)}
          className="flex max-w-md flex-col gap-3"
        >
          <Field label="Password attuale">
            <Input name="corrente" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="Nuova password">
            <Input
              name="nuova"
              type="password"
              required
              minLength={passwordMinima}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Ripeti la nuova password">
            <Input name="conferma" type="password" required autoComplete="new-password" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" name="altri" defaultChecked className="accent-brand" />
            Esci dagli altri dispositivi
          </label>
          {errorePassword && (
            <p role="alert" className="text-sm font-medium text-bad">
              {errorePassword}
            </p>
          )}
          <div>
            <Button type="submit" disabled={inCorso}>
              Cambia password
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
