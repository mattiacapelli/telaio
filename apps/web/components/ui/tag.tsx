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
        "inline-flex items-center gap-[7px] rounded-full border border-ink/16 px-[11px] py-1.5 text-xs leading-none font-medium whitespace-nowrap text-ink-2",
        className,
      )}
    >
      <span aria-hidden className={cn("size-[7px] rounded-full", tones[tone])} />
      {children}
    </span>
  );
}
