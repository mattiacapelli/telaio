import { getImpostazioni } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { SyncTwenty } from "@/components/sync-twenty";
import { SchedulerPannello } from "@/components/scheduler-pannello";
import { TestiStandard } from "@/components/testi-standard";
import { ElencoModelli } from "@/components/pdf-builder/elenco-modelli";
import { ElencoAziende } from "@/components/impostazioni/aziende";
import { CestinoPannello } from "@/components/impostazioni/cestino-pannello";
import { ElencoApiKey } from "@/components/impostazioni/api-keys";
import { ElencoWebhook } from "@/components/impostazioni/webhook";
import { NavigazioneImpostazioni } from "@/components/impostazioni/navigazione";
import { Sezione, Riquadro, Riga, Stato, Dato, ZonaPericolosa } from "@/components/impostazioni/blocchi";
import { ModificaDatiStudio } from "@/components/impostazioni/dati-studio";
import { Button } from "@/components/ui/button";
import { eurCent, n } from "@/lib/format";
import { CATALOGO_EVENTI } from "@/lib/webhook";
import {
  Building2, FileText, RefreshCw, Plug, Clock, Users,
  Database, KeyRound, Mail, GitCommit, LayoutTemplate, Bot, Stamp, Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function ultimaEsecuzione() {
  try {
    return await redis.get("telaio:scheduler:ultima");
  } catch {
    return null;
  }
}

const MODALITA_TRASFERTA: Record<string, string> = {
  CHILOMETRICA: "A chilometri",
  PIE_DI_LISTA: "A piè di lista",
  FORFETTARIA: "Forfettaria",
};

export default async function ImpostazioniPage() {
  const [{ imp, clienti, referenti }, ultima, testi, utenti, modelliPdf, aziende, apiKeys, webhook] = await Promise.all([
    getImpostazioni(),
    ultimaEsecuzione(),
    prisma.testoStandard.findMany({
      where: { eliminataIl: null },
      orderBy: [{ ambito: "asc" }, { ordine: "asc" }, { titolo: "asc" }],
    }),
    prisma.utente.findMany({ orderBy: { email: "asc" } }),
    prisma.modelloPdf.findMany({ where: { eliminataIl: null }, orderBy: [{ ambito: "asc" }, { nome: "asc" }] }),
    prisma.azienda.findMany({ orderBy: [{ predefinita: "desc" }, { ragioneSociale: "asc" }] }),
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.webhook.findMany({
      where: { eliminataIl: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { consegne: true } } },
    }),
  ]);

  const twentyAttivo = Boolean(process.env.TWENTY_API_KEY);
  const githubAttivo = Boolean(process.env.GITHUB_TOKEN);
  const smtpAttivo = Boolean(process.env.SMTP_HOST);
  const schedulerAttivo = Boolean(process.env.SCHEDULER_TOKEN);
  const mcpAttivo = Boolean(process.env.MCP_TOKEN);

  return (
    <NavigazioneImpostazioni
      voci={[
        // ------------------------------------------------------------ studio
        {
          chiave: "studio",
          etichetta: "Dati dello studio",
          icona: <Building2 size={14} />,
          gruppo: "Studio",
          contenuto: (
            <>
              <Sezione
                titolo="Aziende"
                descrizione="Le ragioni sociali da cui puoi emettere documenti. Su ogni preventivo o contratto puoi scegliere quale usare; senza scelta si usa quella predefinita."
              >
                <ElencoAziende aziende={aziende} />
              </Sezione>

              <Sezione
                titolo="Tariffe e pagamenti"
                descrizione="Valori proposti quando crei un nuovo documento. Ogni cliente può avere la sua tariffa."
              >
                <Riquadro>
                  <Dato
                    etichetta="Tariffa oraria di listino"
                    valore={imp ? eurCent(imp.tariffaListino) : null}
                  />
                  <Dato
                    etichetta="Termini di pagamento"
                    valore={`${imp?.terminiPagamento ?? 30} giorni data fattura`}
                  />
                </Riquadro>
                <div className="flex">
                  <div className="flex-1" />
                  <ModificaDatiStudio
                    titolo="Tariffe e pagamenti"
                    valori={{
                      tariffaListino: String(n(imp?.tariffaListino ?? 65)),
                      terminiPagamento: String(imp?.terminiPagamento ?? 30),
                    }}
                    campi={[
                      { chiave: "tariffaListino", etichetta: "Tariffa oraria (EUR)", tipo: "numero" },
                      { chiave: "terminiPagamento", etichetta: "Termini di pagamento (giorni)", tipo: "numero" },
                    ]}
                  />
                </div>
              </Sezione>

              <Sezione
                titolo="Trasferte"
                descrizione="Come vengono calcolate per impostazione predefinita. Su ogni costo puoi comunque scegliere un'altra modalità."
              >
                <Riquadro>
                  <Dato
                    etichetta="Modalità predefinita"
                    valore={MODALITA_TRASFERTA[imp?.modalitaTrasferta ?? "CHILOMETRICA"]}
                  />
                  <Dato
                    etichetta="Tariffa al chilometro"
                    valore={imp ? eurCent(imp.tariffaChilometrica) : null}
                  />
                  <Dato
                    etichetta="Forfait per uscita"
                    valore={imp ? eurCent(imp.forfaitTrasferta) : null}
                  />
                </Riquadro>
                <div className="flex">
                  <div className="flex-1" />
                  <ModificaDatiStudio
                    titolo="Trasferte"
                    valori={{
                      modalitaTrasferta: imp?.modalitaTrasferta ?? "CHILOMETRICA",
                      tariffaChilometrica: String(n(imp?.tariffaChilometrica ?? 0.5)),
                      forfaitTrasferta: String(n(imp?.forfaitTrasferta ?? 30)),
                    }}
                    campi={[
                      {
                        chiave: "modalitaTrasferta",
                        etichetta: "Modalità predefinita",
                        tipo: "scelta",
                        opzioni: Object.entries(MODALITA_TRASFERTA).map(([valore, etichetta]) => ({
                          valore,
                          etichetta,
                        })),
                      },
                      { chiave: "tariffaChilometrica", etichetta: "Tariffa al km (EUR)", tipo: "numero" },
                      { chiave: "forfaitTrasferta", etichetta: "Forfait per uscita (EUR)", tipo: "numero" },
                    ]}
                  />
                </div>
              </Sezione>

              <Sezione
                titolo="Marca da bollo"
                descrizione="Per i regimi esenti IVA: il blocco «Marca da bollo» nei modelli PDF segnala quando applicarla, se attivato."
              >
                <Riquadro>
                  <Dato etichetta="Soglia" valore={imp ? eurCent(imp.sogliaBollo) : null} />
                  <Dato etichetta="Importo" valore={imp ? eurCent(imp.importoBollo) : null} />
                </Riquadro>
                <div className="flex">
                  <div className="flex-1" />
                  <ModificaDatiStudio
                    titolo="Marca da bollo"
                    valori={{
                      sogliaBollo: String(n(imp?.sogliaBollo ?? 77.47)),
                      importoBollo: String(n(imp?.importoBollo ?? 2)),
                    }}
                    campi={[
                      { chiave: "sogliaBollo", etichetta: "Soglia (EUR)", tipo: "numero" },
                      { chiave: "importoBollo", etichetta: "Importo bollo (EUR)", tipo: "numero" },
                    ]}
                  />
                </div>
              </Sezione>
            </>
          ),
        },

        // ------------------------------------------------------------- testi
        {
          chiave: "testi",
          etichetta: "Testi dei documenti",
          icona: <FileText size={14} />,
          gruppo: "Studio",
          contenuto: (
            <Sezione
              titolo="Testi standard"
              descrizione="Clausole e premesse riutilizzabili. Quelli predefiniti vengono copiati nei nuovi documenti; modificarli non riscrive quelli già emessi."
            >
              <Riquadro>
                <TestiStandard testi={testi} />
              </Riquadro>
            </Sezione>
          ),
        },

        // ------------------------------------------------------ integrazioni
        {
          chiave: "modelli-pdf",
          etichetta: "Modelli PDF",
          icona: <LayoutTemplate size={14} />,
          gruppo: "Studio",
          contenuto: (
            <Sezione
              titolo="Modelli PDF"
              descrizione="Compongono i documenti a blocchi: apri un modello per riordinare, attivare o configurare le sue sezioni con il builder."
            >
              <ElencoModelli modelli={modelliPdf} />
            </Sezione>
          ),
        },
        {
          chiave: "twenty",
          etichetta: "Twenty CRM",
          icona: <Plug size={14} />,
          gruppo: "Integrazioni",
          contenuto: (
            <>
              <Sezione
                titolo="Connessione a Twenty"
                descrizione="L'anagrafica clienti è di sola lettura: la fonte di verità è il CRM."
              >
                <Riquadro>
                  <Riga
                    icona={<Database size={14} />}
                    titolo="Stato della connessione"
                    dettaglio={imp?.twentyWorkspace ?? "workspace non configurato"}
                    stato={
                      <Stato
                        testo={twentyAttivo ? "Attiva" : "Non configurata"}
                        tono={twentyAttivo ? "attivo" : "neutro"}
                      />
                    }
                  />
                  <Riga
                    icona={<Users size={14} />}
                    titolo="Record importati"
                    dettaglio={`${clienti} aziende · ${referenti} contatti`}
                  />
                  <Riga
                    icona={<RefreshCw size={14} />}
                    titolo="Frequenza"
                    dettaglio={`ogni ${imp?.twentyFrequenza ?? 15} minuti`}
                  />
                </Riquadro>

                {!twentyAttivo && (
                  <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
                    Imposta <code className="text-text">TWENTY_API_URL</code> e{" "}
                    <code className="text-text">TWENTY_API_KEY</code> nel file{" "}
                    <code className="text-text">.env</code> per attivare la
                    sincronizzazione.
                  </div>
                )}

                <div className="flex">
                  <div className="flex-1" />
                  <SyncTwenty
                    ultimaSync={imp?.twentySyncedAt ? String(imp.twentySyncedAt) : null}
                  />
                </div>
              </Sezione>

              <Sezione
                titolo="Altre integrazioni"
                descrizione="Facoltative: senza configurazione le funzioni che le usano restano disattivate."
              >
                <Riquadro>
                  <Riga
                    icona={<GitCommit size={14} />}
                    titolo="GitHub"
                    dettaglio="commit e pull request sui progetti"
                    stato={
                      <Stato
                        testo={githubAttivo ? "Attiva" : "Non configurata"}
                        tono={githubAttivo ? "attivo" : "neutro"}
                      />
                    }
                  />
                  <Riga
                    icona={<Mail size={14} />}
                    titolo="Posta elettronica"
                    dettaglio="invio email dai workflow"
                    stato={
                      <Stato
                        testo={smtpAttivo ? "Attiva" : "Non configurata"}
                        tono={smtpAttivo ? "attivo" : "neutro"}
                      />
                    }
                  />
                </Riquadro>
              </Sezione>
            </>
          ),
        },

        {
          chiave: "api",
          etichetta: "Accesso API",
          icona: <Bot size={14} />,
          gruppo: "Integrazioni",
          contenuto: (
            <>
              <Sezione
                titolo="Server MCP"
                descrizione="Espone i dati di Telaio a un assistente AI (Claude e simili) tramite il protocollo MCP: può consultare clienti, progetti, ticket, ore, fatture e contratti, oltre a creare ticket, registrare ore e costi, aprire attività."
              >
                <Riquadro>
                  <Riga
                    icona={<Plug size={14} />}
                    titolo="Stato"
                    dettaglio="POST /api/mcp"
                    stato={
                      <Stato
                        testo={apiKeys.some((k) => !k.revocataIl) || mcpAttivo ? "Attivo" : "Non configurato"}
                        tono={apiKeys.some((k) => !k.revocataIl) || mcpAttivo ? "attivo" : "neutro"}
                      />
                    }
                  />
                </Riquadro>

                <div className="space-y-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
                  <p>
                    Configura il client MCP con l&apos;URL del tuo endpoint e l&apos;header{" "}
                    <code className="text-text">Authorization: Bearer &lt;chiave&gt;</code>, usando
                    una delle API key qui sotto.
                  </p>
                  <pre className="overflow-x-auto rounded bg-surface3 p-2 text-[11px] text-text">
{`{
  "mcpServers": {
    "telaio": {
      "url": "https://<il-tuo-dominio>/api/mcp",
      "headers": { "Authorization": "Bearer <chiave>" }
    }
  }
}`}
                  </pre>
                </div>
              </Sezione>

              <Sezione
                titolo="API key"
                descrizione="Ogni chiave è revocabile singolarmente senza toccare le altre. La chiave in chiaro si vede una volta sola, alla creazione."
              >
                <ElencoApiKey chiavi={apiKeys.map((k) => ({
                  id: k.id,
                  nome: k.nome,
                  suffisso: k.suffisso,
                  scadeIl: k.scadeIl ? k.scadeIl.toISOString() : null,
                  ultimoUsoIl: k.ultimoUsoIl ? k.ultimoUsoIl.toISOString() : null,
                  revocataIl: k.revocataIl ? k.revocataIl.toISOString() : null,
                  createdAt: k.createdAt.toISOString(),
                }))} />
              </Sezione>
            </>
          ),
        },
        {
          chiave: "webhook",
          etichetta: "Webhook",
          icona: <WebhookIcon size={14} />,
          gruppo: "Integrazioni",
          contenuto: (
            <Sezione
              titolo="Webhook"
              descrizione="Notifica un tuo sistema esterno quando succede uno degli eventi scelti: una POST firmata (header X-Telaio-Signature) con i dati dell'evento."
            >
              <ElencoWebhook
                webhook={webhook.map((w) => ({
                  id: w.id,
                  nome: w.nome,
                  url: w.url,
                  eventi: w.eventi,
                  attivo: w.attivo,
                  createdAt: w.createdAt.toISOString(),
                  _count: w._count,
                }))}
                catalogo={CATALOGO_EVENTI.map((e) => ({ chiave: e.chiave, etichetta: e.etichetta }))}
              />
            </Sezione>
          ),
        },

        // ----------------------------------------------------------- sistema
        {
          chiave: "automazione",
          etichetta: "Attività ricorrenti",
          icona: <Clock size={14} />,
          gruppo: "Sistema",
          contenuto: (
            <Sezione
              titolo="Attività ricorrenti"
              descrizione="Controlla le scadenze dei contratti, applica i rinnovi, crea gli avvisi ed esegue i workflow a tempo."
            >
              <Riquadro>
                <SchedulerPannello
                  configurato={schedulerAttivo}
                  intervallo={Number(process.env.SCHEDULER_INTERVALLO ?? 3600)}
                  ultima={ultima}
                />
              </Riquadro>
            </Sezione>
          ),
        },
        {
          chiave: "cestino",
          etichetta: "Cestino",
          icona: <Trash2 size={14} />,
          gruppo: "Sistema",
          contenuto: (
            <Sezione
              titolo="Cestino"
              descrizione="I record eliminati restano qui, recuperabili in ogni momento. Eliminarli per sempre richiede di riscrivere il loro nome per conferma."
            >
              <CestinoPannello />
            </Sezione>
          ),
        },
        {
          chiave: "accessi",
          etichetta: "Accessi",
          icona: <KeyRound size={14} />,
          gruppo: "Sistema",
          contenuto: (
            <>
              <Sezione
                titolo="Utenti"
                descrizione="Chi può accedere a Telaio. Gli account si creano da riga di comando."
              >
                <Riquadro>
                  {utenti.map((u) => (
                    <Riga
                      key={u.id}
                      icona={<Users size={14} />}
                      titolo={u.nome}
                      dettaglio={u.email}
                      stato={
                        <Stato
                          testo={u.attivo ? "Attivo" : "Disattivato"}
                          tono={u.attivo ? "attivo" : "neutro"}
                        />
                      }
                    />
                  ))}
                </Riquadro>
                <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
                  Per creare un utente o cambiare una password:{" "}
                  <code className="text-text">node scripts/utente.mjs</code>
                </div>
              </Sezione>

              <ZonaPericolosa descrizione="Chiude tutte le sessioni aperte, comprese quelle sugli altri dispositivi. Dovrai rientrare.">
                <div>
                  <form action="/api/auth/logout" method="post">
                    <Button size="sm" variant="danger" type="submit">
                      Disconnetti tutte le sessioni
                    </Button>
                  </form>
                </div>
              </ZonaPericolosa>
            </>
          ),
        },
      ]}
    />
  );
}
