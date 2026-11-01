"use client";

import * as M from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import { STILE_MENU, STILE_VOCE } from "./dropdown-menu";

export const ContextMenu = M.Root;
export const ContextMenuTrigger = M.Trigger;

export function ContextMenuContent({ className, ...props }: M.ContextMenuContentProps) {
  return (
    <M.Portal>
      <M.Content className={cn(STILE_MENU, className)} {...props} />
    </M.Portal>
  );
}

export function ContextMenuItem({
  className,
  danger,
  ...props
}: M.ContextMenuItemProps & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(STILE_VOCE, danger && "text-bad [&_svg]:text-bad", className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({ className, ...props }: M.ContextMenuSeparatorProps) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}
