import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface VoceBriciola {
  label: string;
  href?: string;
}

export function Breadcrumb({ voci, className }: { voci: VoceBriciola[]; className?: string }) {
  return (
    <nav aria-label="Percorso" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {voci.map((v, i) => {
          const ultima = i === voci.length - 1;
          return (
            <li key={`${v.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {v.href && !ultima ? (
                <Link
                  href={v.href}
                  className="truncate rounded-sm px-1 text-fg-2 transition-colors duration-150 hover:bg-hover hover:text-fg"
                >
                  {v.label}
                </Link>
              ) : (
                <span
                  aria-current={ultima ? "page" : undefined}
                  className={cn("truncate px-1", ultima ? "font-medium text-fg" : "text-fg-2")}
                >
                  {v.label}
                </span>
              )}
              {!ultima && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-3" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
