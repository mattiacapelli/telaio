import { cn } from "@/lib/utils";

const colori = {
  neutral: "#969184",
  blue: "#2b5ea7",
  orange: "#b4532a",
  ink: "#17150f",
  green: "#3d7a4f",
} as const;

const stili = {
  base: undefined,
  solid: { background: "#17150f", borderColor: "#17150f", color: "#f4f3f0" },
  muted: { color: "#6b675c" },
  warn: { borderColor: "rgba(180,83,42,.4)", color: "#8f3f1d" },
} as const;

/** Etichetta `.tag` del mockup, con pallino colorato (`dot={false}` per toglierlo). */
export function Tag({
  tone = "neutral",
  look,
  dot = true,
  children,
  className,
}: {
  tone?: keyof typeof colori;
  /** solid = pieno inchiostro (accettato), muted = spento (rifiutato), warn = arancio (in scadenza) */
  look?: "solid" | "muted" | "warn";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("tag", className)} style={stili[look ?? "base"]}>
      {dot && <i aria-hidden style={{ background: look === "solid" ? "#f4f3f0" : colori[tone] }} />}
      {children}
    </span>
  );
}
