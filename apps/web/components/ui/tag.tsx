import { Badge, type VarianteBadge } from "./badge";

const TONI: Record<string, VarianteBadge> = {
  neutral: "neutral",
  blue: "brand",
  orange: "warn",
  ink: "neutral",
  green: "ok",
};

/** Alias di `Badge` con i nomi usati finora (`tone`, `look`); le pagine nuove usano `Badge`. */
export function Tag({
  tone = "neutral",
  look,
  dot = true,
  children,
  className,
}: {
  tone?: "neutral" | "blue" | "orange" | "ink" | "green";
  look?: "solid" | "muted" | "warn";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const variante: VarianteBadge =
    look === "solid"
      ? "solid"
      : look === "warn"
        ? "warn"
        : look === "muted"
          ? "neutral"
          : (TONI[tone] ?? "neutral");
  return (
    <Badge variant={variante} dot={dot && look !== "solid"} className={className}>
      {children}
    </Badge>
  );
}
