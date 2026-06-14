import type { ReactNode } from "react";

/** Scrollable, max-width content container for the standard (non-console) pages. The
 * dashboard shell is full-height + overflow-hidden, so each page owns its own scroll. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
