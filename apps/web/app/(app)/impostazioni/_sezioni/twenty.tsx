import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";

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
    <Card>
      <CardHeader
        title="Collegamento"
        action={
          <Badge variant={finto ? "warn" : "ok"} dot>
            {finto
              ? process.env.NODE_ENV === "production"
                ? "Non collegato"
                : "Dati finti"
              : "Collegato"}
          </Badge>
        }
      />
      <DefList
        voci={[
          {
            etichetta: "Indirizzo",
            valore: (
              <span className="font-mono text-xs">{host ?? "TWENTY_API_URL non impostato"}</span>
            ),
          },
          { etichetta: "Clienti già usati in Telaio", valore: riferimenti, numerico: true },
          {
            etichetta: "Ultima sincronizzazione",
            valore: ultimaSync ? ultimaSync.toLocaleString("it-IT") : "mai",
          },
        ]}
      />
      <p className="mt-3 max-w-prose text-sm text-fg-2">
        Twenty resta la fonte di verità: Telaio legge aziende, persone e opportunità e non le
        duplica. Ogni 30 minuti il worker riallinea nome, P.IVA, PEC e codice SDI dei clienti già
        usati. Le sole scritture ammesse verso Twenty sono la fase dell&apos;opportunità e
        l&apos;allegato PDF. Si configura con{" "}
        <code className="font-mono text-xs">TWENTY_API_URL</code> e{" "}
        <code className="font-mono text-xs">TWENTY_API_KEY</code> nel file{" "}
        <code className="font-mono text-xs">.env</code>.
      </p>
    </Card>
  );
}
