import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-grey-1",
  blue: "bg-blue",
  orange: "bg-orange",
  ink: "bg-ink",
  green: "bg-[#3d7a4f]",
} as const;

/** Tag con pallino colorato. */
export function Tag({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-ink-2",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tones[tone])} />
      {children}
    </span>
  );
}
