"use client";

import { Copy, Download, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { alInvio, messaggioErrore } from "./errori";

type Fase = "riposo" | "attiva" | "scansione" | "codici" | "disattiva" | "rigenera";

function CodiciDiRecupero({ codici }: { codici: string[] }) {
  const testo = codici.join("\n");
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-sm text-fg-2">
        Conservali in un posto sicuro (un gestore di password va bene). Ognuno vale una sola volta e
        serve se perdi il telefono. Non verranno mostrati di nuovo.
      </p>
      <ul className="grid max-w-sm grid-cols-2 gap-1.5 rounded-md border border-line bg-subtle p-3 font-mono text-sm">
        {codici.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(testo).then(
              () => toast("Codici copiati"),
              () => toast.errore("Copia non riuscita"),
            );
          }}
        >
          <Copy /> Copia
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`${testo}\n`], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "telaio-codici-di-recupero.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> Scarica
        </Button>
      </div>
    </div>
  );
}

/** Autenticazione a due fattori con app (TOTP) e codici di recupero. Ogni cambio chiede la password. */
export function DueFattori({ attivo }: { attivo: boolean }) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("riposo");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [qr, setQr] = useState<{ img: string; segreto: string } | null>(null);
  const [codici, setCodici] = useState<string[]>([]);

  function chiudi() {
    setFase("riposo");
    setErrore(null);
    setQr(null);
    setCodici([]);
    router.refresh();
  }

  async function avvia(formData: FormData) {
    setErrore(null);
    setInCorso(true);
    const { data, error } = await authClient.twoFactor.enable({
      password: String(formData.get("password")),
    });
    if (error || !data || !("totpURI" in data)) {
      setInCorso(false);
      return setErrore(messaggioErrore(error));
    }
    const segreto = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setQr({ img: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192 }), segreto });
    setCodici(data.backupCodes);
    setInCorso(false);
    setFase("scansione");
  }

  async function conferma(formData: FormData) {
    setErrore(null);
    setInCorso(true);
    const { error } = await authClient.twoFactor.verifyTotp({
      code: String(formData.get("codice")).replace(/\s/g, ""),
    });
    setInCorso(false);
    if (error) return setErrore("Codice non valido: controlla l'ora del telefono e riprova");
    setQr(null);
    setFase("codici");
    toast("Verifica in due passaggi attivata");
  }

  async function disattiva(formData: FormData) {
    setErrore(null);
    setInCorso(true);
    const { error } = await authClient.twoFactor.disable({
      password: String(formData.get("password")),
    });
    setInCorso(false);
    if (error) return setErrore(messaggioErrore(error));
    toast("Verifica in due passaggi disattivata");
    chiudi();
  }

  async function rigenera(formData: FormData) {
    setErrore(null);
    setInCorso(true);
    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password: String(formData.get("password")),
    });
    setInCorso(false);
    if (error || !data) return setErrore(messaggioErrore(error));
    setCodici(data.backupCodes);
    setFase("codici");
  }

  const richiestaPassword = (
    azione: (f: FormData) => Promise<void>,
    testo: string,
    danger = false,
  ) => (
    <form onSubmit={alInvio(azione)} className="flex max-w-sm flex-col gap-3">
      <Field label="Conferma con la tua password">
        <Input name="password" type="password" required autoFocus autoComplete="current-password" />
      </Field>
      {errore && (
        <p role="alert" className="text-sm font-medium text-bad">
          {errore}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant={danger ? "danger" : "primary"} disabled={inCorso}>
          {testo}
        </Button>
        <Button type="button" variant="ghost" onClick={chiudi}>
          Annulla
        </Button>
      </div>
    </form>
  );

  return (
    <Card>
      <CardHeader
        title="Verifica in due passaggi"
        description="Oltre alla password serve un codice dall'app di autenticazione (Google Authenticator, 1Password, Authy…)."
        action={
          <Badge variant={attivo ? "ok" : "neutral"} dot>
            {attivo ? "Attiva" : "Non attiva"}
          </Badge>
        }
      />
      {fase === "riposo" &&
        (attivo ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFase("rigenera")}>
              Nuovi codici di recupero
            </Button>
            <Button variant="secondary" onClick={() => setFase("disattiva")}>
              Disattiva
            </Button>
          </div>
        ) : (
          <Button onClick={() => setFase("attiva")}>
            <ShieldCheck /> Attiva
          </Button>
        ))}
      {fase === "attiva" && richiestaPassword(avvia, "Continua")}
      {fase === "disattiva" && richiestaPassword(disattiva, "Disattiva", true)}
      {fase === "rigenera" && richiestaPassword(rigenera, "Genera nuovi codici")}
      {fase === "scansione" && qr && (
        <div className="flex flex-col gap-4">
          <p className="max-w-prose text-sm text-fg-2">
            1. Nell&apos;app di autenticazione aggiungi un account e inquadra il codice. 2. Scrivi
            qui il codice a 6 cifre che mostra per completare l&apos;attivazione.
          </p>
          <div className="flex flex-wrap items-start gap-5">
            <img
              src={qr.img}
              alt="Codice QR per l'app di autenticazione"
              width={192}
              height={192}
              className="rounded-md border border-line"
            />
            <div className="flex flex-col gap-3">
              <div className="text-sm">
                <p className="text-fg-2">Non riesci a inquadrarlo? Inserisci a mano la chiave:</p>
                <code className="mt-1 block rounded-md bg-subtle px-2 py-1 font-mono text-xs break-all">
                  {qr.segreto}
                </code>
              </div>
              <form onSubmit={alInvio(conferma)} className="flex max-w-xs flex-col gap-3">
                <Field label="Codice a 6 cifre">
                  <Input
                    name="codice"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9 ]{6,7}"
                    required
                    autoFocus
                  />
                </Field>
                {errore && (
                  <p role="alert" className="text-sm font-medium text-bad">
                    {errore}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={inCorso}>
                    Verifica e attiva
                  </Button>
                  <Button type="button" variant="ghost" onClick={chiudi}>
                    Annulla
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {fase === "codici" && (
        <div className="flex flex-col gap-3">
          <CodiciDiRecupero codici={codici} />
          <div>
            <Button onClick={chiudi}>Li ho salvati</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
