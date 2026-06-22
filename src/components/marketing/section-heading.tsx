import { cn } from "@/lib/utils";

/**
 * Shared section heading — an optional uppercase eyebrow, a serif display title, and a
 * lead paragraph. Editorial styling: large transitional serif, generous measure.
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
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </span>
      )}
      <h2 className="text-balance font-serif text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "text-pretty text-base text-muted-foreground sm:text-lg",
            align === "center" && "mx-auto max-w-2xl",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}
