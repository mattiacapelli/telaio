import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function InkPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ink", className)} {...props} />;
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
    <div
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
      style={{ color: "#3a372f" }}
    >
      <div aria-hidden className="size-12 rounded-full border border-dashed border-grey-1" />
      <h2 className="h2">{title}</h2>
      {children && (
        <p style={{ margin: 0, maxWidth: "46ch", fontSize: 14, color: "#6b675c" }}>{children}</p>
      )}
      {action}
    </div>
  );
}
