import { cn } from "@/lib/utils";

export type VarianteBadge = "neutral" | "brand" | "ok" | "warn" | "bad" | "solid";

const STILI: Record<VarianteBadge, { box: string; dot: string }> = {
  neutral: { box: "bg-subtle text-fg-2 border-line", dot: "bg-fg-3" },
  brand: { box: "bg-brand-soft text-brand border-transparent", dot: "bg-brand" },
  ok: { box: "bg-ok-soft text-ok border-transparent", dot: "bg-ok" },
  warn: { box: "bg-warn-soft text-warn border-transparent", dot: "bg-warn" },
  bad: { box: "bg-bad-soft text-bad border-transparent", dot: "bg-bad" },
  solid: { box: "bg-fg text-on-fg border-transparent", dot: "bg-on-fg" },
};

/** Etichetta di stato: sfondo tenue, testo nello stesso colore, pallino opzionale. */
export function Badge({
  variant = "neutral",
  dot = false,
  className,
  children,
}: {
  variant?: VarianteBadge;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const s = STILI[variant];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-xs font-medium whitespace-nowrap",
        s.box,
        className,
      )}
    >
      {dot && <i aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />}
      {children}
    </span>
  );
}
