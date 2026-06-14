import { AlertTriangle } from "lucide-react";

/**
 * Shared shell for the placeholder legal pages. The pages ship as honest templates — the
 * banner makes clear they must be replaced with reviewed policies before production use.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-6 lg:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          This is a placeholder template for the open-source project, not legal advice. Replace it
          with a policy reviewed by counsel before running Threadline in production.
        </p>
      </div>

      <div className="mt-8 space-y-5 text-[0.95rem] leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold text-foreground">{children}</h2>;
}
