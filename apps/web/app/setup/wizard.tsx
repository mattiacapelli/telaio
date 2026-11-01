"use client";

import {
  adminSchema,
  anagraficaAdminSchema,
  aziendaSchema,
  erroriPerCampo,
  FUSI_ORARI,
  formatoValido,
  formattaNumero,
  LINGUE,
  LOGO_MAX_BYTE,
  OPZIONI_PASSWORD_MINIMA,
  PAESI,
  PASSWORD_MINIMA_BASE,
  preferenzeSchema,
  sicurezzaSchema,
  TIPI_AZIENDA,
  VALUTE,
} from "@telaio/core";
import type { BozzaPubblica } from "@telaio/db";
import { AlertTriangle, Check, CheckCircle2, ImagePlus, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { Controllo } from "@/lib/setup-server";
import { cn } from "@/lib/utils";
import {
  completaSetup,
  type EsitoSetup,
  iniziaSetup,
  salvaAdmin,
  salvaAzienda,
  salvaPreferenze,
  salvaSicurezza,
} from "./actions";
import { Guscio } from "./guscio";

const PASSI = ["Benvenuto", "Azienda", "Amministratore", "Sicurezza", "Preferenze", "Conferma"];

interface Dati {
  azienda: {
    nome: string;
    tipo: string;
    partitaIva: string;
    paese: string;
    fusoOrario: string;
    valuta: string;
    lingua: string;
    logo: string | null;
  };
  admin: { nome: string; cognome: string; email: string; password: string; conferma: string };
  sicurezza: { passwordMinima: 12 | 14 | 16; guidaSicurezza: boolean };
  preferenze: {
    ivaAttiva: boolean;
    aliquotaIva: string;
    formatoPreventivo: string;
    formatoFattura: string;
  };
}

function iniziali(b: BozzaPubblica): Dati {
  return {
    azienda: {
      nome: b.azienda?.nome ?? "",
      tipo: b.azienda?.tipo ?? "ditta_individuale",
      partitaIva: b.azienda?.partitaIva ?? "",
      paese: b.azienda?.paese ?? "IT",
      fusoOrario: b.azienda?.fusoOrario ?? "Europe/Rome",
      valuta: b.azienda?.valuta ?? "EUR",
      lingua: b.azienda?.lingua ?? "it",
      logo: b.azienda?.logo ?? null,
    },
    // La password non torna mai dal server: chi riprende dopo un refresh può lasciarla vuota.
    admin: {
      nome: b.admin?.nome ?? "",
      cognome: b.admin?.cognome ?? "",
      email: b.admin?.email ?? "",
      password: "",
      conferma: "",
    },
    sicurezza: {
      passwordMinima: b.sicurezza?.passwordMinima ?? 12,
      guidaSicurezza: b.sicurezza?.guidaSicurezza ?? true,
    },
    preferenze: {
      ivaAttiva: b.preferenze?.ivaAttiva ?? true,
      aliquotaIva: String(b.preferenze?.aliquotaIva ?? 22).replace(".", ","),
      formatoPreventivo: b.preferenze?.formatoPreventivo ?? "P-{AAAA}-{NNN}",
      formatoFattura: b.preferenze?.formatoFattura ?? "F-{AAAA}-{NNN}",
    },
  };
}

const aliquotaNumero = (testo: string) => Number(testo.trim().replace(",", "."));

/** Wizard di prima configurazione: sei passi, ognuno salvato sul server prima di passare al successivo. */
export function Wizard({ bozza, controlli }: { bozza: BozzaPubblica; controlli: Controllo[] }) {
  const router = useRouter();
  const [passo, setPasso] = useState(Math.min(Math.max(bozza.passo, 1), 6));
  const [raggiunto, setRaggiunto] = useState(Math.min(Math.max(bozza.passo, 1), 6));
  const [dati, setDati] = useState<Dati>(() => iniziali(bozza));
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [confermato, setConfermato] = useState(false);
  const [inCorso, avvia] = useTransition();
  const titolo = useRef<HTMLHeadingElement>(null);
  const passwordImpostata = !!bozza.admin;

  useEffect(() => {
    titolo.current?.focus();
  }, [passo]);

  function vai(n: number) {
    setErrori({});
    setMessaggio(null);
    setPasso(n);
  }

  function esegui(azione: () => Promise<EsitoSetup>, prossimo: number) {
    setErrori({});
    setMessaggio(null);
    avvia(async () => {
      const r = await azione();
      if (r.ok) {
        setRaggiunto((m) => Math.max(m, prossimo));
        setPasso(prossimo);
        return;
      }
      setErrori(r.errori ?? {});
      setMessaggio(r.messaggio ?? null);
      if (r.completato) router.replace("/login");
    });
  }

  function aggiorna<K extends keyof Dati>(sezione: K, campo: keyof Dati[K], valore: unknown) {
    setDati((d) => ({ ...d, [sezione]: { ...d[sezione], [campo]: valore } }));
    setErrori((e) => {
      if (!((campo as string) in e)) return e;
      const { [campo as string]: _, ...resto } = e;
      return resto;
    });
  }

  const bloccoControlli = controlli.some((c) => c.esito === "errore");

  function invia(e: React.FormEvent) {
    e.preventDefault();
    if (inCorso) return;
    if (passo === 1) return esegui(() => iniziaSetup(), 2);
    if (passo === 2) {
      const r = aziendaSchema.safeParse(dati.azienda);
      if (!r.success) return setErrori(erroriPerCampo(r.error));
      return esegui(() => salvaAzienda(dati.azienda), 3);
    }
    if (passo === 3) {
      const mantieni = passwordImpostata && !dati.admin.password && !dati.admin.conferma;
      const r = mantieni
        ? anagraficaAdminSchema.safeParse(dati.admin)
        : adminSchema().safeParse(dati.admin);
      if (!r.success) return setErrori(erroriPerCampo(r.error));
      return esegui(() => salvaAdmin(dati.admin), 4);
    }
    if (passo === 4) {
      const r = sicurezzaSchema.safeParse(dati.sicurezza);
      if (!r.success) return setErrori(erroriPerCampo(r.error));
      return esegui(() => salvaSicurezza(dati.sicurezza), 5);
    }
    if (passo === 5) {
      const preferenze = {
        ...dati.preferenze,
        aliquotaIva: aliquotaNumero(dati.preferenze.aliquotaIva),
      };
      const r = preferenzeSchema.safeParse(preferenze);
      if (!r.success) return setErrori(erroriPerCampo(r.error));
      return esegui(() => salvaPreferenze(preferenze), 6);
    }
    if (!confermato) return;
    esegui(() => completaSetup(), 6);
  }

  const ultimo = passo === 6;
  const etichettaAvanti = inCorso
    ? ultimo
      ? "Inizializzazione…"
      : "Salvataggio…"
    : ultimo
      ? "Inizializza Telaio"
      : passo === 1
        ? "Inizia"
        : "Continua";

  return (
    <Guscio
      titolo="Configura Telaio"
      descrizione={`Passo ${passo} di 6 · ${PASSI[passo - 1]}`}
      larga
    >
      <Avanzamento passo={passo} raggiunto={raggiunto} vai={vai} disabilitato={inCorso} />
      <form onSubmit={invia} noValidate className="flex flex-col gap-5">
        <h2
          ref={titolo}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
          aria-live="polite"
        >
          {PASSI[passo - 1]}
        </h2>

        {passo === 1 && <Benvenuto controlli={controlli} />}
        {passo === 2 && <PassoAzienda dati={dati.azienda} errori={errori} aggiorna={aggiorna} />}
        {passo === 3 && (
          <PassoAdmin
            dati={dati.admin}
            errori={errori}
            aggiorna={aggiorna}
            passwordImpostata={passwordImpostata}
          />
        )}
        {passo === 4 && (
          <PassoSicurezza
            dati={dati.sicurezza}
            errori={errori}
            aggiorna={aggiorna}
            controlli={controlli.filter((c) => c.gruppo === "sicurezza")}
          />
        )}
        {passo === 5 && (
          <PassoPreferenze dati={dati.preferenze} errori={errori} aggiorna={aggiorna} />
        )}
        {passo === 6 && (
          <Riepilogo dati={dati} confermato={confermato} setConfermato={setConfermato} />
        )}

        {messaggio && (
          <p
            role="alert"
            className="rounded-md border border-line bg-bad-soft px-3 py-2 text-sm font-medium text-bad"
          >
            {messaggio}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          {passo > 1 ? (
            <Button type="button" variant="ghost" onClick={() => vai(passo - 1)} disabled={inCorso}>
              Indietro
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            disabled={inCorso || (passo === 1 && bloccoControlli) || (ultimo && !confermato)}
            className="h-9 min-w-36"
          >
            {etichettaAvanti}
          </Button>
        </div>
      </form>
    </Guscio>
  );
}

/** Barra di avanzamento con i passi cliccabili fino a quello raggiunto. */
function Avanzamento({
  passo,
  raggiunto,
  vai,
  disabilitato,
}: {
  passo: number;
  raggiunto: number;
  vai: (n: number) => void;
  disabilitato: boolean;
}) {
  return (
    <nav aria-label="Avanzamento della configurazione" className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={6}
        aria-valuenow={passo}
        aria-label={`Passo ${passo} di 6`}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200"
          style={{ width: `${(passo / 6) * 100}%` }}
        />
      </div>
      <ol className="flex justify-between gap-1">
        {PASSI.map((nome, i) => {
          const n = i + 1;
          const fatto = n < passo || (n <= raggiunto && n !== passo);
          const raggiungibile = n <= raggiunto && n !== passo;
          return (
            <li key={nome} className="flex min-w-0 flex-1 justify-center">
              <button
                type="button"
                disabled={!raggiungibile || disabilitato}
                onClick={() => vai(n)}
                aria-current={n === passo ? "step" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 text-xs disabled:cursor-default",
                  raggiungibile && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-xs font-medium",
                    n === passo
                      ? "border-brand bg-brand text-brand-fg"
                      : fatto
                        ? "border-brand/30 bg-brand-soft text-brand"
                        : "border-line bg-surface text-fg-3",
                  )}
                >
                  {fatto ? <Check className="size-3.5" /> : n}
                </span>
                <span
                  className={cn(
                    "hidden truncate sm:block",
                    n === passo ? "font-medium text-fg" : "text-fg-3",
                  )}
                >
                  {nome}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type Aggiorna = <K extends keyof Dati>(sezione: K, campo: keyof Dati[K], valore: unknown) => void;

const ICONE = {
  ok: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Superato" />,
  avviso: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Attenzione" />,
  errore: <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Errore" />,
};

function ElencoControlli({ controlli }: { controlli: Controllo[] }) {
  return (
    <ul className="divide-y divide-line rounded-md border border-line">
      {controlli.map((c) => (
        <li key={c.id} className="flex gap-2.5 px-3 py-2.5 text-sm">
          {ICONE[c.esito]}
          <span className="flex flex-col">
            <span className="font-medium">{c.etichetta}</span>
            {c.nota && <span className="text-xs text-fg-2">{c.nota}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Benvenuto({ controlli }: { controlli: Controllo[] }) {
  const router = useRouter();
  const errore = controlli.some((c) => c.esito === "errore");
  return (
    <>
      <p className="max-w-prose text-sm text-fg-2">
        Benvenuto in Telaio. In pochi passi crei la tua azienda e il primo amministratore. Questa
        procedura si può fare una volta sola: a configurazione completata questa pagina non sarà più
        raggiungibile.
      </p>
      <ElencoControlli controlli={controlli} />
      {errore && (
        <div className="flex items-center justify-between gap-3 text-sm text-bad">
          <span>Risolvi gli errori e ricontrolla per continuare.</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => router.refresh()}>
            Ricontrolla
          </Button>
        </div>
      )}
    </>
  );
}

function Opzioni({ elenco }: { elenco: readonly (readonly [string, string])[] }) {
  return elenco.map(([v, l]) => (
    <option key={v} value={v}>
      {l}
    </option>
  ));
}

function PassoAzienda({
  dati,
  errori,
  aggiorna,
}: {
  dati: Dati["azienda"];
  errori: Record<string, string>;
  aggiorna: Aggiorna;
}) {
  const [erroreLogo, setErroreLogo] = useState<string | null>(null);
  const set =
    (campo: keyof Dati["azienda"]) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      aggiorna("azienda", campo, e.target.value);

  function leggiLogo(file: File | undefined) {
    setErroreLogo(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type))
      return setErroreLogo("Usa un'immagine PNG, JPEG o WebP.");
    if (file.size > LOGO_MAX_BYTE) return setErroreLogo("Il logo non può superare i 200 KB.");
    const lettore = new FileReader();
    lettore.onload = () => aggiorna("azienda", "logo", String(lettore.result));
    lettore.readAsDataURL(file);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Nome dell'azienda" error={errori.nome}>
          <Input
            name="nome"
            value={dati.nome}
            onChange={set("nome")}
            autoComplete="organization"
            autoFocus
          />
        </Field>
        <Field label="Tipo" error={errori.tipo}>
          <Select name="tipo" value={dati.tipo} onChange={set("tipo")}>
            <Opzioni elenco={TIPI_AZIENDA} />
          </Select>
        </Field>
      </div>
      <Field
        label="Partita IVA (facoltativa)"
        hint="Per l'Italia sono 11 cifre."
        error={errori.partitaIva}
      >
        <Input
          name="partitaIva"
          value={dati.partitaIva}
          onChange={set("partitaIva")}
          inputMode="numeric"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paese" error={errori.paese}>
          <Select name="paese" value={dati.paese} onChange={set("paese")}>
            <Opzioni elenco={PAESI} />
          </Select>
        </Field>
        <Field label="Fuso orario" error={errori.fusoOrario}>
          <Select name="fusoOrario" value={dati.fusoOrario} onChange={set("fusoOrario")}>
            {FUSI_ORARI.map((f) => (
              <option key={f} value={f}>
                {f.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valuta" error={errori.valuta}>
          <Select name="valuta" value={dati.valuta} onChange={set("valuta")}>
            <Opzioni elenco={VALUTE} />
          </Select>
        </Field>
        <Field
          label="Lingua"
          hint="L'interfaccia è oggi solo in italiano: la scelta resta salvata per il futuro."
          error={errori.lingua}
        >
          <Select name="lingua" value={dati.lingua} onChange={set("lingua")}>
            <Opzioni elenco={LINGUE} />
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Logo (facoltativo)</span>
        <div className="flex items-center gap-3">
          {dati.logo ? (
            <>
              <img
                src={dati.logo}
                alt="Anteprima del logo"
                className="size-12 rounded-md border border-line object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => aggiorna("azienda", "logo", null)}
              >
                <Trash2 /> Rimuovi
              </Button>
            </>
          ) : (
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm hover:bg-hover">
              <ImagePlus className="size-4 text-fg-2" /> Scegli un'immagine
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => leggiLogo(e.target.files?.[0])}
              />
            </label>
          )}
          <span className="text-xs text-fg-3">PNG, JPEG o WebP, fino a 200 KB</span>
        </div>
        {(erroreLogo ?? errori.logo) && (
          <span role="alert" className="text-xs font-medium text-bad">
            {erroreLogo ?? errori.logo}
          </span>
        )}
      </div>
    </>
  );
}

function PassoAdmin({
  dati,
  errori,
  aggiorna,
  passwordImpostata,
}: {
  dati: Dati["admin"];
  errori: Record<string, string>;
  aggiorna: Aggiorna;
  passwordImpostata: boolean;
}) {
  const set = (campo: keyof Dati["admin"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    aggiorna("admin", campo, e.target.value);
  return (
    <>
      <p className="max-w-prose text-sm text-fg-2">
        Sarà l'amministratore di Telaio, con tutti i permessi. Non esiste nessuna password
        predefinita: la scegli tu.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errori.nome}>
          <Input
            name="nome"
            value={dati.nome}
            onChange={set("nome")}
            autoComplete="given-name"
            autoFocus
          />
        </Field>
        <Field label="Cognome" error={errori.cognome}>
          <Input
            name="cognome"
            value={dati.cognome}
            onChange={set("cognome")}
            autoComplete="family-name"
          />
        </Field>
      </div>
      <Field label="Email" hint="È anche il tuo nome utente per accedere." error={errori.email}>
        <Input
          name="email"
          type="email"
          value={dati.email}
          onChange={set("email")}
          autoComplete="username"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Password"
          hint={
            passwordImpostata
              ? "Già impostata: lasciala vuota per mantenerla."
              : `Almeno ${PASSWORD_MINIMA_BASE} caratteri.`
          }
          error={errori.password}
        >
          <Input
            name="password"
            type="password"
            value={dati.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Conferma password" error={errori.conferma}>
          <Input
            name="conferma"
            type="password"
            value={dati.conferma}
            onChange={set("conferma")}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </>
  );
}

function PassoSicurezza({
  dati,
  errori,
  aggiorna,
  controlli,
}: {
  dati: Dati["sicurezza"];
  errori: Record<string, string>;
  aggiorna: Aggiorna;
  controlli: Controllo[];
}) {
  return (
    <>
      <ElencoControlli controlli={controlli} />
      <Field
        label="Lunghezza minima delle password"
        hint="Vale per ogni cambio di password futuro."
        error={errori.passwordMinima}
      >
        <Select
          name="passwordMinima"
          value={String(dati.passwordMinima)}
          onChange={(e) => aggiorna("sicurezza", "passwordMinima", Number(e.target.value))}
        >
          {OPZIONI_PASSWORD_MINIMA.map((n) => (
            <option key={n} value={n}>
              {n} caratteri
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-4 rounded-md border border-line px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Guidami ad attivare 2FA e passkey</span>
          <span className="text-sm text-fg-2">
            Dopo il primo accesso ti porto in «Profilo e sicurezza» per proteggere l'account.
          </span>
        </div>
        <Switch
          label="Guidami ad attivare 2FA e passkey"
          checked={dati.guidaSicurezza}
          onCheckedChange={(v) => aggiorna("sicurezza", "guidaSicurezza", v)}
        />
      </div>
    </>
  );
}

function anteprima(formato: string): string | undefined {
  return formatoValido(formato)
    ? `Esempio: ${formattaNumero(formato, 1, new Date().getFullYear())}`
    : undefined;
}

function PassoPreferenze({
  dati,
  errori,
  aggiorna,
}: {
  dati: Dati["preferenze"];
  errori: Record<string, string>;
  aggiorna: Aggiorna;
}) {
  const set = (campo: keyof Dati["preferenze"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    aggiorna("preferenze", campo, e.target.value);
  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-md border border-line px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Applico l'IVA ai documenti</span>
          <span className="text-sm text-fg-2">
            Se non la applichi, regime e dicitura si completano poi in Impostazioni → IVA e fiscale.
          </span>
        </div>
        <Switch
          label="Applico l'IVA ai documenti"
          checked={dati.ivaAttiva}
          onCheckedChange={(v) => aggiorna("preferenze", "ivaAttiva", v)}
        />
      </div>
      {dati.ivaAttiva && (
        <Field label="Aliquota IVA (%)" error={errori.aliquotaIva}>
          <Input
            name="aliquotaIva"
            value={dati.aliquotaIva}
            onChange={set("aliquotaIva")}
            inputMode="decimal"
            className="max-w-32"
          />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Numerazione dei preventivi"
          hint={anteprima(dati.formatoPreventivo)}
          error={errori.formatoPreventivo}
        >
          <Input
            name="formatoPreventivo"
            value={dati.formatoPreventivo}
            onChange={set("formatoPreventivo")}
            className="font-mono"
          />
        </Field>
        <Field
          label="Numerazione delle fatture"
          hint={anteprima(dati.formatoFattura)}
          error={errori.formatoFattura}
        >
          <Input
            name="formatoFattura"
            value={dati.formatoFattura}
            onChange={set("formatoFattura")}
            className="font-mono"
          />
        </Field>
      </div>
      <p className="text-xs text-fg-3">
        Token: {"{AAAA}"} anno, {"{AA}"} anno a due cifre, {"{NNN}"} numero progressivo con zeri.
      </p>
    </>
  );
}

function Riepilogo({
  dati,
  confermato,
  setConfermato,
}: {
  dati: Dati;
  confermato: boolean;
  setConfermato: (v: boolean) => void;
}) {
  const nomeDi = (elenco: readonly (readonly [string, string])[], v: string) =>
    elenco.find(([k]) => k === v)?.[1] ?? v;
  return (
    <>
      <p className="max-w-prose text-sm text-fg-2">
        Controlla i dati. Con «Inizializza Telaio» vengono creati l'azienda e l'amministratore e la
        configurazione si chiude: non si potrà ripetere.
      </p>
      <Card className="flex flex-col gap-4">
        <DefList
          voci={[
            { etichetta: "Azienda", valore: dati.azienda.nome },
            { etichetta: "Tipo", valore: nomeDi(TIPI_AZIENDA, dati.azienda.tipo) },
            { etichetta: "Partita IVA", valore: dati.azienda.partitaIva || "—" },
            { etichetta: "Paese", valore: nomeDi(PAESI, dati.azienda.paese) },
            { etichetta: "Fuso orario", valore: dati.azienda.fusoOrario },
            {
              etichetta: "Valuta e lingua",
              valore: `${dati.azienda.valuta} · ${dati.azienda.lingua.toUpperCase()}`,
            },
            { etichetta: "Logo", valore: dati.azienda.logo ? "Caricato" : "Nessuno" },
          ]}
        />
        <DefList
          voci={[
            { etichetta: "Amministratore", valore: `${dati.admin.nome} ${dati.admin.cognome}` },
            { etichetta: "Email", valore: dati.admin.email },
            { etichetta: "Password", valore: "Impostata" },
          ]}
        />
        <DefList
          voci={[
            {
              etichetta: "Lunghezza minima password",
              valore: `${dati.sicurezza.passwordMinima} caratteri`,
            },
            {
              etichetta: "Guida a 2FA e passkey",
              valore: dati.sicurezza.guidaSicurezza ? "Sì" : "No",
            },
            {
              etichetta: "IVA",
              valore: dati.preferenze.ivaAttiva
                ? `${dati.preferenze.aliquotaIva}%`
                : "Non applicata",
            },
            { etichetta: "Numerazione preventivi", valore: dati.preferenze.formatoPreventivo },
            { etichetta: "Numerazione fatture", valore: dati.preferenze.formatoFattura },
          ]}
        />
      </Card>
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox
          name="conferma"
          checked={confermato}
          onChange={(e) => setConfermato(e.target.checked)}
          className="mt-0.5"
        />
        <span>Ho controllato i dati e voglio inizializzare Telaio.</span>
      </label>
    </>
  );
}
