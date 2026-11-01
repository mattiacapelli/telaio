"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { pulisciCache } from "@/lib/pwa";

export function LoginForm({ inizia2fa = false }: { inizia2fa?: boolean }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [richiede2fa, setRichiede2fa] = useState(inizia2fa);
  const [recupero, setRecupero] = useState(false);

  async function accedi(formData: FormData) {
    setErrore(null);
    setPending(true);
    try {
      if (richiede2fa) {
        const codice = String(formData.get("codice")).trim();
        const { error } = recupero
          ? await authClient.twoFactor.verifyBackupCode({ code: codice })
          : await authClient.twoFactor.verifyTotp({ code: codice.replace(/\s/g, "") });
        if (error) return setErrore("Codice non valido");
        await pulisciCache();
        return router.replace("/");
      }
      const { data, error } = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      if (error) return setErrore("Email o password non corretti");
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect)
        return setRichiede2fa(true);
      await pulisciCache();
      router.replace("/");
    } finally {
      setPending(false);
    }
  }

  async function conPasskey() {
    setErrore(null);
    const { error } = await authClient.signIn.passkey();
    if (error) return setErrore("Accesso con passkey non riuscito");
    await pulisciCache();
    router.replace("/");
  }

  return (
    <form action={accedi} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accedi a Telaio</h1>
        <p className="text-sm text-fg-2">Il gestionale commerciale. Accesso riservato.</p>
      </div>
      {richiede2fa ? (
        <>
          <Field label={recupero ? "Codice di recupero" : "Codice di verifica (TOTP)"}>
            <Input
              key={recupero ? "recupero" : "totp"}
              name="codice"
              inputMode={recupero ? "text" : "numeric"}
              autoComplete="one-time-code"
              required
              autoFocus
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              setRecupero((r) => !r);
              setErrore(null);
            }}
            className="-mt-2 cursor-pointer self-start text-sm text-fg-2 underline-offset-2 hover:text-fg hover:underline"
          >
            {recupero ? "Usa il codice dell'app" : "Usa un codice di recupero"}
          </button>
        </>
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
      {richiede2fa && (
        <button
          type="button"
          onClick={() => {
            setRichiede2fa(false);
            setRecupero(false);
            setErrore(null);
            router.replace("/login");
          }}
          className="-mt-2 cursor-pointer text-sm text-fg-2 hover:text-fg hover:underline"
        >
          Torna all&apos;accesso
        </button>
      )}
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
