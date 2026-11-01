"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [richiede2fa, setRichiede2fa] = useState(false);

  async function accedi(formData: FormData) {
    setErrore(null);
    setPending(true);
    try {
      if (richiede2fa) {
        const { error } = await authClient.twoFactor.verifyTotp({
          code: String(formData.get("codice")),
        });
        if (error) return setErrore("Codice non valido");
        return router.replace("/");
      }
      const { data, error } = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      if (error) return setErrore("Email o password non corretti");
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect)
        return setRichiede2fa(true);
      router.replace("/");
    } finally {
      setPending(false);
    }
  }

  async function conPasskey() {
    setErrore(null);
    const { error } = await authClient.signIn.passkey();
    if (error) return setErrore("Accesso con passkey non riuscito");
    router.replace("/");
  }

  return (
    <form action={accedi} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accedi a Telaio</h1>
        <p className="text-sm text-fg-2">Il gestionale commerciale. Accesso riservato.</p>
      </div>
      {richiede2fa ? (
        <Field label="Codice di verifica (TOTP)">
          <Input
            name="codice"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </Field>
      ) : (
        <>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="username webauthn" required autoFocus />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete="current-password webauthn"
              required
            />
          </Field>
        </>
      )}
      {errore && (
        <p role="alert" className="text-sm font-medium text-bad">
          {errore}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-9">
        {pending ? "Accesso…" : richiede2fa ? "Verifica" : "Accedi"}
      </Button>
      {!richiede2fa && (
        <>
          <div className="flex items-center gap-3 text-xs text-fg-3">
            <span className="h-px flex-1 bg-line" />
            oppure
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button type="button" variant="secondary" onClick={conPasskey} className="h-9">
            <KeyRound /> Continua con passkey
          </Button>
        </>
      )}
    </form>
  );
}
