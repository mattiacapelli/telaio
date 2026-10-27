import { cn } from "@/lib/utils";

const colori = {
  neutral: "#969184",
  blue: "#2b5ea7",
  orange: "#b4532a",
  ink: "#17150f",
  green: "#3d7a4f",
} as const;

/** Etichetta `.tag` del mockup, con pallino colorato (`dot={false}` per toglierlo). */
export function Tag({
  tone = "neutral",
  dot = true,
  children,
  className,
}: {
  tone?: keyof typeof colori;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("tag", className)}>
      {dot && <i aria-hidden style={{ background: colori[tone] }} />}
      {children}
    </span>
  );
}
