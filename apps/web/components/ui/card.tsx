import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Contenitore: bianco, bordo sottile, nessuna ombra. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-4", className)} {...props} />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Pannello scuro: usato finché le pagine non sono migrate; le nuove preferiscono `Card`. */
export function InkPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-fg p-5 text-white", className)} {...props} />;
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full border border-line bg-subtle text-fg-3">
        <Inbox aria-hidden className="size-5" />
      </span>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {children && <p className="max-w-md text-sm text-fg-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
