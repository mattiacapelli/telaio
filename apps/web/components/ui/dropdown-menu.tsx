"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;
export const DropdownMenuRadioGroup = M.RadioGroup;

export const STILE_VOCE =
  "relative flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm text-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-2";
export const STILE_MENU =
  "z-50 min-w-44 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-[pop-in_120ms_ease-out]";

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "start",
  ...props
}: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(STILE_MENU, className)}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: M.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(STILE_VOCE, danger && "text-bad [&_svg]:text-bad", className)}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: M.DropdownMenuCheckboxItemProps) {
  return (
    <M.CheckboxItem className={cn(STILE_VOCE, "pl-7", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <M.ItemIndicator>
          <Check className="size-4 text-brand" />
        </M.ItemIndicator>
      </span>
      {children}
    </M.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: M.DropdownMenuRadioItemProps) {
  return (
    <M.RadioItem className={cn(STILE_VOCE, "pl-7", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <M.ItemIndicator>
          <Circle className="size-2 fill-brand text-brand" />
        </M.ItemIndicator>
      </span>
      {children}
    </M.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: M.DropdownMenuLabelProps) {
  return (
    <M.Label className={cn("px-2 py-1.5 text-xs font-medium text-fg-3", className)} {...props} />
  );
}

export function DropdownMenuSeparator({ className, ...props }: M.DropdownMenuSeparatorProps) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}
