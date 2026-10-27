import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card p-5 sm:p-7", className)} {...props} />;
}

export function InkPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ink-panel p-5 sm:p-7", className)} {...props} />;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div aria-hidden className="size-12 rounded-full border border-dashed border-grey-1" />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
