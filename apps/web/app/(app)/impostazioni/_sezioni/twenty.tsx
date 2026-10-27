import { st } from "@/lib/utils";

/** Stato del collegamento a Twenty CRM. La configurazione resta nel file .env. */
export function SezioneTwenty({
  finto,
  host,
  riferimenti,
  ultimaSync,
}: {
  finto: boolean;
  host: string | null;
  riferimenti: number;
  ultimaSync: Date | null;
}) {
  return (
    <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
      <div
        style={st(
          "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px",
        )}
      >
        <h2 className="h2">Collegamento</h2>
        <span className="tag">
          <i style={{ background: finto ? "#b4532a" : "#3d7a4f" }} />
          {finto ? "Dati finti" : "Collegato"}
        </span>
      </div>
      <dl style={st("margin:0;border-top:1px solid rgba(23,21,15,.14)")}>
        <div className="kv">
          <dt>Indirizzo</dt>
          <dd className="mono">{host ?? "TWENTY_API_URL non impostato"}</dd>
        </div>
        <div className="kv">
          <dt>Clienti già usati in Telaio</dt>
          <dd className="num">{riferimenti}</dd>
        </div>
        <div className="kv" style={{ borderBottom: 0 }}>
          <dt>Ultima sincronizzazione</dt>
          <dd>{ultimaSync ? ultimaSync.toLocaleString("it-IT") : "mai"}</dd>
        </div>
      </dl>
      <p className="lead">
        Twenty resta la fonte di verità: Telaio legge aziende, persone e opportunità e non le
        duplica. Ogni 30 minuti il worker riallinea nome, P.IVA, PEC e codice SDI dei clienti già
        usati. Le sole scritture ammesse verso Twenty sono la fase dell&apos;opportunità e
        l&apos;allegato PDF. Si configura con <code>TWENTY_API_URL</code> e{" "}
        <code>TWENTY_API_KEY</code> nel file <code>.env</code>.
      </p>
    </div>
  );
}
