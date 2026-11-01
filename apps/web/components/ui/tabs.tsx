"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List className={cn("flex gap-4 border-b border-line", className)} {...props} />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px inline-flex h-9 cursor-pointer items-center gap-2 border-b-2 border-transparent px-0.5 text-sm font-medium text-fg-2 transition-colors duration-150 hover:text-fg data-[state=active]:border-brand data-[state=active]:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-4 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
