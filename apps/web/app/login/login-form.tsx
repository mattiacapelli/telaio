"use client";

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
    <form action={accedi} className="mt-8 flex flex-col gap-4">
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
        <p role="alert" className="text-sm font-medium text-orange-2">
          {errore}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Accesso…" : richiede2fa ? "Verifica" : "Accedi"}
      </Button>
      {!richiede2fa && (
        <Button type="button" variant="ghost" onClick={conPasskey}>
          Accedi con passkey
        </Button>
      )}
    </form>
  );
}
