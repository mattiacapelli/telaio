import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { Field, Input } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import type { StatoArchivio } from "@/lib/archivio/config";
import { creaBucketAction, provaArchivioAction, salvaArchivioAction } from "../actions";

const ORIGINE = {
  impostazioni: "Impostazioni dell'app",
  ambiente: "Variabili d'ambiente",
} as const;

/** Dove finiscono i file dei progetti: un bucket S3 (o compatibile), configurato qui. */
export function SezioneArchiviazione({ stato }: { stato: StatoArchivio }) {
  const { config } = stato;
  return (
    <>
      <Card>
        <CardHeader
          title="Archivio dei documenti"
          description="I file dei progetti (contratti, specifiche, consegne) non stanno nel database: vanno in un bucket S3 o compatibile (MinIO, Cloudflare R2, Backblaze…)."
          action={
            <Badge variant={config ? "ok" : "warn"} dot>
              {config ? "Configurato" : "Non configurato"}
            </Badge>
          }
        />
        {config ? (
          <DefList
            voci={[
              { etichetta: "Servizio", valore: config.endpoint || "Amazon S3" },
              { etichetta: "Regione", valore: config.region },
              {
                etichetta: "Bucket",
                valore: <span className="font-mono text-xs">{config.bucket}</span>,
              },
              {
                etichetta: "Cartella",
                valore: config.prefisso ? (
                  <span className="font-mono text-xs">{config.prefisso}</span>
                ) : (
                  "Radice del bucket"
                ),
              },
              {
                etichetta: "Indirizzi",
                valore: config.pathStyle
                  ? "Con il bucket nel percorso (path-style)"
                  : "Con il bucket nel nome host",
              },
              {
                etichetta: "Chiavi di accesso",
                valore: stato.credenziali
                  ? `${stato.origine.credenziali === "impostazioni" ? "Salvate (cifrate)" : "Variabili d'ambiente"} · ${stato.credenziali.accessKeyId}`
                  : "Nessuna: ruolo IAM o profilo del server",
              },
              {
                etichetta: "Configurazione da",
                valore: config && stato.origine.config ? ORIGINE[stato.origine.config] : "—",
              },
            ]}
          />
        ) : (
          <p className="max-w-prose text-sm text-warn">
            Finché non indichi un bucket non si possono caricare documenti. Indica il bucket e, se
            non è su Amazon S3, l&apos;indirizzo del servizio.
          </p>
        )}
        {stato.segretoIllegibile && (
          <p role="alert" className="mt-3 max-w-prose text-sm text-bad">
            Le chiavi salvate non si possono più leggere (il segreto dell&apos;app è cambiato):
            reinseriscile.
          </p>
        )}
        <p className="mt-3 max-w-prose text-xs text-fg-3">
          Le chiavi si salvano cifrate nel database e non tornano mai al browser. I permessi minimi
          da dare alle chiavi: lettura, scrittura ed eliminazione di oggetti sul solo bucket.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <FormModal
            trigger={config ? "Modifica" : "Configura"}
            title="Archiviazione dei documenti"
            description="Le chiavi lasciate vuote restano quelle già salvate."
            action={salvaArchivioAction}
          >
            <Field
              label="Indirizzo del servizio"
              name="endpoint"
              hint="Vuoto per Amazon S3. Per MinIO e simili: https://… o http://…"
            >
              <Input
                name="endpoint"
                defaultValue={config?.endpoint ?? ""}
                placeholder="https://s3.example.com"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bucket" name="bucket">
                <Input
                  name="bucket"
                  required
                  defaultValue={config?.bucket ?? ""}
                  placeholder="telaio-documenti"
                />
              </Field>
              <Field label="Regione" name="region">
                <Input name="region" defaultValue={config?.region ?? "us-east-1"} />
              </Field>
            </div>
            <Field
              label="Cartella nel bucket"
              name="prefisso"
              hint="Facoltativa: tutti i file vanno sotto questo percorso"
            >
              <Input name="prefisso" defaultValue={config?.prefisso ?? ""} placeholder="telaio" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="pathStyle"
                defaultChecked={config?.pathStyle ?? false}
                className="mt-0.5 accent-brand"
              />
              <span>
                Bucket nel percorso (path-style)
                <span className="block text-xs text-fg-3">
                  Serve a MinIO e a molti servizi compatibili.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Access key ID" name="accessKeyId">
                <Input
                  name="accessKeyId"
                  autoComplete="off"
                  placeholder={stato.accessKeyId ?? ""}
                />
              </Field>
              <Field label="Secret access key" name="secretAccessKey">
                <Input
                  name="secretAccessKey"
                  type="password"
                  autoComplete="new-password"
                  placeholder={stato.origine.credenziali === "impostazioni" ? "••••••••" : ""}
                />
              </Field>
            </div>
            {stato.origine.credenziali === "impostazioni" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="rimuoviChiavi" className="accent-brand" />
                Rimuovi le chiavi salvate
              </label>
            )}
          </FormModal>
          {config && (
            <>
              <FormModal
                trigger="Prova la connessione"
                triggerVariant="secondary"
                title="Prova la connessione"
                description="Scrive, legge ed elimina un piccolo file di prova nel bucket."
                submitLabel="Prova"
                action={provaArchivioAction}
              >
                <p className="text-sm text-fg-2">
                  Controlla che l&apos;indirizzo, le chiavi e i permessi siano giusti.
                </p>
              </FormModal>
              <FormModal
                trigger="Crea il bucket"
                triggerVariant="secondary"
                title="Crea il bucket"
                description={`Crea «${config.bucket}» sul servizio, se non esiste ancora.`}
                submitLabel="Crea"
                action={creaBucketAction}
              >
                <p className="text-sm text-fg-2">
                  Di solito il bucket si crea dal pannello del provider. Su MinIO in sviluppo basta
                  questo pulsante.
                </p>
              </FormModal>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
