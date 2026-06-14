"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Full-height three-pane console shell. On desktop both the list and the thread show;
 * on mobile only one shows at a time (list on the index, thread on /conversations/[id]). */
export function ConsoleLayout({ list, children }: { list: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const onThread = /^\/conversations\/[^/]+/.test(pathname);

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "flex-col border-r bg-card md:flex md:w-[380px] md:flex-none",
          onThread ? "hidden" : "flex w-full",
        )}
      >
        {list}
      </div>
      <div className={cn("min-w-0 flex-1", onThread ? "flex" : "hidden md:flex")}>{children}</div>
    </div>
  );
}
