import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent } from "@/components/ui/card";

/** Centered card layout shared by the login and signup pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <BrandLogo />
        </Link>
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-medium tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Card>
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
        {footer ? (
          <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
