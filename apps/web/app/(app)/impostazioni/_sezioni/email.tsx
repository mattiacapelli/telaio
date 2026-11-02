import { type EmailImpostazioni, risolviMittente } from "@telaio/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import type { statoSmtp } from "@/lib/email";
import { inviaEmailDiProva, salvaFirmaEmailAzione, salvaMittenteEmail } from "../actions";
import type { RagioneSocialeRow } from "./tipi";

/** Email: com'è configurato l'invio, da chi partono i messaggi di ogni ragione sociale e la firma. */
export function SezioneEmail({
  elenco,
  impostazioni,
  smtp,
  emailUtente,
}: {
  elenco: RagioneSocialeRow[];
  impostazioni: EmailImpostazioni;
  smtp: ReturnType<typeof statoSmtp>;
  emailUtente: string;
}) {
  return (
    <>
      <Card>
        <CardHeader
          title="Invio"
          description="I messaggi (per ora i solleciti, sempre dopo la tua conferma) partono dal server SMTP configurato per l'app."
          action={
            <Badge variant={smtp.configurato ? "ok" : "warn"} dot>
              {smtp.configurato ? "SMTP configurato" : "SMTP non configurato"}
            </Badge>
          }
        />
        <DefList
          voci={[
            { etichetta: "Server", valore: `${smtp.host}:${smtp.porta}` },
            {
              etichetta: "Connessione",
              valore: smtp.sicura ? "TLS (porta 465)" : "STARTTLS se il server lo offre",
            },
            {
              etichetta: "Autenticazione",
              valore: smtp.autenticato ? "Con utente e password" : "Nessuna",
            },
            {
              etichetta: "Mittente di sistema",
              valore: <span className="font-mono text-xs">{smtp.mittenteSistema}</span>,
            },
          ]}
        />
        {!smtp.configurato && (
          <p className="mt-3 max-w-prose text-sm text-warn">
            Nessun server SMTP: le email non arriveranno a destinazione. Imposta SMTP_HOST (e, se
            serve, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE) nelle variabili d&apos;ambiente
            e riavvia.
          </p>
        )}
        <p className="mt-3 max-w-prose text-xs text-fg-3">
          Le credenziali restano nelle variabili d&apos;ambiente del server: non passano dal browser
          e non si salvano nel database.
        </p>
        <div className="mt-4">
          <FormModal
            trigger="Invia email di prova"
            triggerVariant="secondary"
            title="Email di prova"
            description={`Manda un messaggio a ${emailUtente}, con il mittente e la firma della ragione sociale scelta.`}
            submitLabel="Invia"
            action={inviaEmailDiProva}
          >
            <Field label="Ragione sociale">
              <Select name="id" defaultValue={elenco[0]?.id ?? ""}>
                {elenco.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.nome}
                  </option>
                ))}
                <option value="">Solo il mittente di sistema</option>
              </Select>
            </Field>
          </FormModal>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Mittenti"
          description="Nome e indirizzo con cui i destinatari vedono le email di ogni ragione sociale."
        />
        <ul className="divide-y divide-line rounded-md border border-line">
          {elenco.map((rs) => {
            const m = impostazioni.mittenti[rs.id];
            const { from, replyTo } = risolviMittente({ mittente: m, ragioneSociale: rs });
            return (
              <li key={rs.id} className="flex items-center justify-between gap-4 px-3 py-3 text-sm">
                <div className="flex min-w-0 flex-col leading-snug">
                  <span className="font-medium">{rs.nome}</span>
                  <span className="truncate font-mono text-xs text-fg-2">
                    {from ?? `${smtp.mittenteSistema} (di sistema)`}
                  </span>
                  {replyTo && <span className="text-xs text-fg-2">Risposte a {replyTo}</span>}
                  {!m?.email && !rs.email && (
                    <span className="text-xs text-warn">
                      Nessun indirizzo: si usa il mittente di sistema.
                    </span>
                  )}
                </div>
                <FormModal
                  trigger="Modifica"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  title={`Mittente · ${rs.nome}`}
                  description="Lascia vuoto un campo per usare il valore della ragione sociale."
                  action={salvaMittenteEmail}
                >
                  <input type="hidden" name="id" value={rs.id} />
                  <Field label="Nome mostrato" hint={`Predefinito: ${rs.nome}`} name="nome">
                    <Input name="nome" defaultValue={m?.nome ?? ""} maxLength={80} />
                  </Field>
                  <Field
                    label="Indirizzo email del mittente"
                    hint={
                      rs.email ? `Predefinito: ${rs.email}` : "La ragione sociale non ha un'email"
                    }
                    name="email"
                  >
                    <Input name="email" type="email" defaultValue={m?.email ?? ""} />
                  </Field>
                  <Field
                    label="Le risposte arrivano a"
                    hint="Solo se diverso dal mittente."
                    name="rispondiA"
                  >
                    <Input name="rispondiA" type="email" defaultValue={m?.rispondiA ?? ""} />
                  </Field>
                  <p className="text-xs text-fg-3">
                    Il server SMTP può rifiutare mittenti che non controlla: provalo con «Invia
                    email di prova».
                  </p>
                </FormModal>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Firma"
          description="Si aggiunge in fondo a ogni email inviata dall'app."
          action={
            <FormModal
              trigger="Modifica"
              triggerVariant="secondary"
              triggerSize="sm"
              title="Firma delle email"
              action={salvaFirmaEmailAzione}
            >
              <Field label="Testo della firma" hint="Fino a 500 caratteri." name="firma">
                <Textarea name="firma" defaultValue={impostazioni.firma} rows={6} maxLength={500} />
              </Field>
            </FormModal>
          }
        />
        {impostazioni.firma ? (
          <pre className="rounded-md bg-subtle px-3 py-2 font-sans text-sm whitespace-pre-wrap">
            {impostazioni.firma}
          </pre>
        ) : (
          <p className="text-sm text-fg-2">Nessuna firma impostata.</p>
        )}
      </Card>
    </>
  );
}
