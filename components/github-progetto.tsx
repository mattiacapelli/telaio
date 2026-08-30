import { GitCommit, GitPullRequest, ExternalLink } from "lucide-react";
import type { AttivitaRepo } from "@/lib/github";

/**
 * Attività della repository collegata.
 *
 * L'integrazione è facoltativa: se manca il token o la repo non è
 * raggiungibile, mostriamo il motivo invece di nascondere il riquadro, così
 * si capisce che cosa configurare.
 */
export function GithubProgetto({
  repo,
  attivita,
}: {
  repo: string;
  attivita: AttivitaRepo;
}) {
  const max = Math.max(...attivita.perGiorno.map((g) => g.n), 1);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <GitCommit size={13} className="text-muted" />
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1 text-md font-medium hover:underline"
        >
          {repo}
          <ExternalLink size={11} className="text-faint" />
        </a>
        <div className="flex-1" />
        {attivita.pullAperte > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <GitPullRequest size={11} />
            {attivita.pullAperte}
          </span>
        )}
      </div>

      {attivita.errore ? (
        <div className="px-3 py-4 text-center text-md text-faint">
          {attivita.errore}
        </div>
      ) : (
        <>
          {/* Commit per giorno nelle ultime 4 settimane. */}
          <div className="border-b border-border p-2">
            <div className="flex h-10 items-end gap-[2px]">
              {attivita.perGiorno.map((g) => (
                <div
                  key={g.giorno}
                  title={`${g.giorno}: ${g.n} commit`}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max((g.n / max) * 100, 6)}%`,
                    background: g.n > 0 ? "var(--accent)" : "var(--border)",
                    opacity: g.n > 0 ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-faint">
              Ultime 4 settimane · {attivita.commit.length} commit recenti
            </div>
          </div>

          {attivita.commit.length === 0 ? (
            <div className="px-3 py-4 text-center text-md text-faint">
              Nessun commit trovato
            </div>
          ) : (
            attivita.commit.slice(0, 8).map((c) => (
              <a
                key={c.sha}
                href={c.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-0 hover:bg-[var(--alpha-lighter)]"
              >
                <code className="flex-none text-xs text-faint">{c.sha}</code>
                <span className="min-w-0 flex-1 truncate text-md">{c.messaggio}</span>
                <span className="flex-none text-xs text-faint">{c.autore}</span>
              </a>
            ))
          )}
        </>
      )}
    </div>
  );
}
