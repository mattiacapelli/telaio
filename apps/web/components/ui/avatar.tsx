import { cn } from "@/lib/utils";

const MISURE = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" } as const;

/** Iniziali su fondo neutro; con `src` mostra l'immagine. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof MISURE;
  className?: string;
}) {
  const iniziali = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-hover font-medium text-fg-2",
        MISURE[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : iniziali}
    </span>
  );
}
