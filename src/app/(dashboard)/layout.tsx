import type { ReactNode } from "react";

import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { getActiveBrand } from "@/lib/auth/brand";
import { env } from "@/lib/config/env";
import * as brands from "@/lib/db/repos/brands";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Guards the whole console: redirects to /login if there's no session, and is
  // the ONLY source of brandId for this subtree.
  const { brandId, name, email } = await getActiveBrand();
  const brand = await brands.getById(brandId);

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          brandName={brand?.name ?? "Your brand"}
          userName={name}
          userEmail={email}
          devMode={!env.SEND_REAL_SMS}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
