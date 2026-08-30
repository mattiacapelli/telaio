import { getImpostazioni } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { SyncTwenty } from "@/components/sync-twenty";
import { SchedulerPannello } from "@/components/scheduler-pannello";
import { TestiStandard } from "@/components/testi-standard";
import { ElencoModelli } from "@/components/pdf-builder/elenco-modelli";
import { NavigazioneImpostazioni } from "@/components/impostazioni/navigazione";
import { Sezione, Riquadro, Riga, Stato, Dato, ZonaPericolosa } from "@/components/impostazioni/blocchi";
import { ModificaDatiStudio } from "@/components/impostazioni/dati-studio";
import { Button } from "@/components/ui/button";
import { eurCent, n } from "@/lib/format";
import {
  Building2, FileText, RefreshCw, Plug, Clock, Users,
  Database, KeyRound, Mail, GitCommit, LayoutTemplate,
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
  const [{ imp, clienti, referenti }, ultima, testi, utenti, modelliPdf] = await Promise.all([
    getImpostazioni(),
    ultimaEsecuzione(),
    prisma.testoStandard.findMany({
      orderBy: [{ ambito: "asc" }, { ordine: "asc" }, { titolo: "asc" }],
    }),
    prisma.utente.findMany({ orderBy: { email: "asc" } }),
    prisma.modelloPdf.findMany({ orderBy: [{ ambito: "asc" }, { nome: "asc" }] }),
  ]);

  const twentyAttivo = Boolean(process.env.TWENTY_API_KEY);
  const githubAttivo = Boolean(process.env.GITHUB_TOKEN);
  const smtpAttivo = Boolean(process.env.SMTP_HOST);
  const schedulerAttivo = Boolean(process.env.SCHEDULER_TOKEN);

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
                titolo="Dati dello studio"
                descrizione="Compaiono nell'intestazione di preventivi, contratti e fatture."
              >
                <Riquadro>
                  <Dato etichetta="Ragione sociale" valore={imp?.ragioneSociale} />
                  <Dato etichetta="Partita IVA" valore={imp?.partitaIva} />
                  <Dato etichetta="IBAN" valore={imp?.iban} />
                </Riquadro>
                <div className="flex">
                  <div className="flex-1" />
                  <ModificaDatiStudio
                    titolo="Dati dello studio"
                    valori={{
                      ragioneSociale: imp?.ragioneSociale ?? "",
                      partitaIva: imp?.partitaIva ?? "",
                      iban: imp?.iban ?? "",
                    }}
                    campi={[
                      { chiave: "ragioneSociale", etichetta: "Ragione sociale" },
                      { chiave: "partitaIva", etichetta: "Partita IVA" },
                      { chiave: "iban", etichetta: "IBAN", nota: "Stampato sui documenti di pagamento" },
                    ]}
                  />
                </div>
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
