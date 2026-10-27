import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Porta nel JSX uno stile scritto come nel mockup: st("display:flex;gap:8px"). */
export function st(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const dich of css.split(";")) {
    const i = dich.indexOf(":");
    if (i < 0) continue;
    const chiave = dich
      .slice(0, i)
      .trim()
      .replace(/^-webkit-/, "webkit-")
      .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[chiave.replace(/^webkit/, "Webkit")] = dich.slice(i + 1).trim();
  }
  return out as React.CSSProperties;
}
