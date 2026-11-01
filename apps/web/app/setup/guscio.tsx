import { Card } from "@/components/ui/card";

/** Cornice delle pagine di setup: logo, titolo e contenuto al centro. */
export function Guscio({
  titolo,
  descrizione,
  larga = false,
  children,
}: {
  titolo: string;
  descrizione?: string;
  larga?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-start justify-items-center bg-subtle px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:place-items-center">
      <div className={`flex w-full flex-col gap-6 ${larga ? "max-w-2xl" : "max-w-md"}`}>
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Telaio</span>
        </div>
        <Card className="p-6 shadow-xs">
          <h1 className="text-xl font-semibold tracking-tight">{titolo}</h1>
          {descrizione && <p className="mt-1 text-sm text-fg-2">{descrizione}</p>}
          <div className="mt-5 flex flex-col gap-4">{children}</div>
        </Card>
      </div>
    </main>
  );
}
