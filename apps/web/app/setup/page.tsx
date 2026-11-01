import { bozzaPubblica, getDb, leggiBozza } from "@telaio/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  accessoConsentito,
  controlliSistema,
  modalitaSetup,
  setupCompletato,
} from "@/lib/setup-server";
import { CodiceSetup } from "./codice";
import { Guscio } from "./guscio";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurazione iniziale" };

/**
 * Prima configurazione. Si apre solo se l'installazione non è ancora stata inizializzata:
 * dopo il completamento questa pagina non è più raggiungibile (rimanda a login o dashboard).
 */
export default async function SetupPage() {
  let completato: boolean;
  try {
    completato = await setupCompletato();
  } catch {
    return (
      <Guscio titolo="Database non raggiungibile">
        <p className="text-sm text-fg-2">
          Telaio non riesce a collegarsi al database. Controlla che sia avviato e che le migrazioni
          siano state applicate, poi ricarica la pagina.
        </p>
      </Guscio>
    );
  }
  if (completato) redirect((await getSession()) ? "/" : "/login");

  const modalita = modalitaSetup();
  if (modalita.modalita === "bloccato") {
    return (
      <Guscio titolo="Configurazione non disponibile">
        <p className="text-sm text-fg-2">{modalita.motivo}</p>
      </Guscio>
    );
  }
  if (!(await accessoConsentito())) {
    return (
      <Guscio titolo="Codice di setup">
        <CodiceSetup />
      </Guscio>
    );
  }

  const [bozza, controlli] = await Promise.all([leggiBozza(getDb()), controlliSistema()]);
  return <Wizard bozza={bozzaPubblica(bozza)} controlli={controlli} />;
}
