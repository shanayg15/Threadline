import { MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Threadline wordmark — a chat glyph plus the name set in the display serif. Monochrome,
 * so it adopts whatever theme it sits in (editorial black-on-white across the app).
 */
export function BrandLogo({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <MessageSquareText className="size-5 shrink-0" strokeWidth={1.75} />
      {!iconOnly && (
        <span className="font-serif text-xl font-medium tracking-tight">Threadline</span>
      )}
    </span>
  );
}
