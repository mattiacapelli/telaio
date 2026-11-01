import { cn } from "@/lib/utils";

/** Tabella semplice per elenchi corti e senza interazioni (le altre usano DataTable). */
export function Table({
  className,
  children,
  minLarghezza = 560,
}: {
  className?: string;
  children: React.ReactNode;
  minLarghezza?: number;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface", className)}>
      <table
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth: minLarghezza }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  destra,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { destra?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-8 border-b border-line bg-subtle px-3 text-xs font-medium whitespace-nowrap text-fg-2",
        destra && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  destra,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { destra?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-2 align-middle text-sm group-last:border-b-0",
        destra && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
