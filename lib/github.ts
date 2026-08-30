/**
 * Lettura dell'attività di una repository GitHub.
 *
 * L'integrazione è facoltativa: senza token o senza repo collegata, la scheda
 * progetto funziona esattamente come prima. Nessuna funzione qui solleva
 * eccezioni verso la pagina — un errore di rete non deve impedire di vedere
 * il progetto.
 */

export type Commit = {
  sha: string;
  messaggio: string;
  autore: string;
  data: string;
  url: string;
};

export type AttivitaRepo = {
  commit: Commit[];
  /** Commit per giorno nelle ultime 4 settimane, per il grafico. */
  perGiorno: { giorno: string; n: number }[];
  branch: string | null;
  pullAperte: number;
  errore?: string;
};

export function githubConfigurato() {
  return Boolean(process.env.GITHUB_TOKEN);
}

/** Accetta sia `owner/repo` sia un URL completo. */
export function normalizzaRepo(valore: string): string | null {
  const pulito = valore.trim().replace(/\.git$/, "");
  const daUrl = pulito.match(/github\.com[/:]([^/]+\/[^/]+)/);
  const candidato = daUrl ? daUrl[1] : pulito;
  return /^[\w.-]+\/[\w.-]+$/.test(candidato) ? candidato : null;
}

async function chiamata<T>(percorso: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com${percorso}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // I dati cambiano di continuo: niente cache lato Next.
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("repository non trovata o non accessibile");
    if (res.status === 401) throw new Error("token GitHub non valido");
    if (res.status === 403) throw new Error("limite di richieste GitHub raggiunto");
    throw new Error(`GitHub ha risposto ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type CommitApi = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
};

/**
 * Ultimi commit e attività della repo.
 *
 * Restituisce sempre un oggetto: in caso di errore lo espone in `errore`
 * invece di sollevare, così la pagina mostra il motivo e resta utilizzabile.
 */
export async function attivitaRepo(
  repo: string,
  branch?: string | null,
): Promise<AttivitaRepo> {
  const vuoto: AttivitaRepo = {
    commit: [],
    perGiorno: [],
    branch: branch ?? null,
    pullAperte: 0,
  };

  if (!githubConfigurato()) {
    return { ...vuoto, errore: "GITHUB_TOKEN non configurato" };
  }

  try {
    const query = new URLSearchParams({ per_page: "30" });
    if (branch) query.set("sha", branch);

    const [commitApi, pull] = await Promise.all([
      chiamata<CommitApi[]>(`/repos/${repo}/commits?${query}`),
      chiamata<{ length: number }>(`/repos/${repo}/pulls?state=open&per_page=100`).catch(
        () => [] as unknown as { length: number },
      ),
    ]);

    const commit: Commit[] = commitApi.map((c) => ({
      sha: c.sha.slice(0, 7),
      // Solo la prima riga: il corpo del messaggio qui non serve.
      messaggio: (c.commit.message ?? "").split("\n")[0],
      autore: c.author?.login ?? c.commit.author?.name ?? "sconosciuto",
      data: c.commit.author?.date ?? new Date().toISOString(),
      url: c.html_url,
    }));

    // Conteggio per giorno sulle ultime 4 settimane.
    const conteggio = new Map<string, number>();
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      conteggio.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of commit) {
      const g = c.data.slice(0, 10);
      if (conteggio.has(g)) conteggio.set(g, (conteggio.get(g) ?? 0) + 1);
    }

    return {
      commit,
      perGiorno: [...conteggio.entries()].map(([giorno, n]) => ({ giorno, n })),
      branch: branch ?? null,
      pullAperte: Array.isArray(pull) ? pull.length : 0,
    };
  } catch (e) {
    return { ...vuoto, errore: e instanceof Error ? e.message : "errore sconosciuto" };
  }
}
