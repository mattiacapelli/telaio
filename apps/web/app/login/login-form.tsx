"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <form
      action={accedi}
      style={{
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="eb">Accedi</span>
        <h1
          className="d"
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: 44,
            lineHeight: 1.04,
            letterSpacing: "-.03em",
          }}
        >
          Bentornato.
        </h1>
      </div>
      {richiede2fa ? (
        <div className="f">
          <label className="lbl" htmlFor="codice">
            Codice di verifica (TOTP)
          </label>
          <input
            id="codice"
            name="codice"
            className="in"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </div>
      ) : (
        <>
          <div className="f">
            <label className="lbl" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              className="in"
              type="email"
              autoComplete="username webauthn"
              required
            />
          </div>
          <div className="f">
            <label className="lbl" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              className="in"
              type="password"
              autoComplete="current-password webauthn"
              required
            />
          </div>
        </>
      )}
      {errore && (
        <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#8f3f1d" }}>
          {errore}
        </p>
      )}
      <button type="submit" className="bp" disabled={pending} style={{ padding: "16px 22px" }}>
        {pending ? "Accesso…" : richiede2fa ? "Verifica" : "Accedi"}{" "}
        <span aria-hidden="true">→</span>
      </button>
      {!richiede2fa && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: "#6b675c",
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1, height: 1, background: "rgba(23,21,15,.14)" }} />
            oppure
            <span style={{ flex: 1, height: 1, background: "rgba(23,21,15,.14)" }} />
          </div>
          <button
            type="button"
            className="bg"
            onClick={conPasskey}
            style={{ padding: "16px 22px" }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21c0-3.9 3.1-7 7-7 1.5 0 2.9.5 4 1.3" />
              <circle cx="18" cy="15" r="2.5" />
              <path d="M18 17.5V22M18 20h2" />
            </svg>
            Continua con passkey
          </button>
        </>
      )}
    </form>
  );
}
