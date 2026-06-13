import { MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";

/** Threadline wordmark — a coral chat mark plus the name. */
export function BrandLogo({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <MessageSquareText className="h-4 w-4" />
      </span>
      {!iconOnly && <span className="text-lg font-semibold tracking-tight">Threadline</span>}
    </span>
  );
}
