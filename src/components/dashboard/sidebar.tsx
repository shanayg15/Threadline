import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

/** Persistent left rail (desktop). The mobile equivalent lives in a Sheet opened
 * from the top bar. */
export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("w-60 shrink-0 flex-col border-r bg-card", className)}>
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/conversations">
          <BrandLogo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav />
      </div>
    </aside>
  );
}
