import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One dashboard panel. Every panel must be able to say "I have nothing to
 * show" honestly — a dashboard that invents numbers is worse than an empty one.
 */
export function DashboardPanel({
  title,
  action,
  actionHref,
  empty,
  className,
  children,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  /** Shown instead of children when there is no data. */
  empty?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card flex flex-col gap-3 rounded-xl border p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action && actionHref ? (
          <Link
            href={actionHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs"
          >
            {action}
            <ArrowUpRight className="size-3" />
          </Link>
        ) : null}
      </div>

      {empty ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        children
      )}
    </section>
  );
}
