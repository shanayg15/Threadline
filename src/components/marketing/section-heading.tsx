import { cn } from "@/lib/utils";

/**
 * Shared section heading — an optional eyebrow kicker, a display title, and a lead
 * paragraph. Keeps the marketing sections visually consistent.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </span>
      )}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {lead && <p className="text-pretty text-base text-muted-foreground sm:text-lg">{lead}</p>}
    </div>
  );
}
