import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-y rounded-md border border-border bg-surface2 px-2.5 py-1.5 text-md leading-relaxed text-text outline-none transition-colors placeholder:text-faint focus:border-accent-line focus:ring-1 focus:ring-accent-line",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
