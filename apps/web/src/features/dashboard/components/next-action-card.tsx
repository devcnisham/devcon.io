import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import type { NextAction } from "@/features/dashboard/lib/next-action";
import { Button } from "@/components/ui/button";

/**
 * The most important element on the screen: one thing to do, and why.
 *
 * Deliberately larger and higher than every other panel. A new developer who
 * reads nothing else should still know what to do next.
 */
export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section className="bg-primary/5 border-primary/20 flex flex-col gap-3 rounded-xl border p-5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Compass className="size-3.5" />
        Do this next
      </p>

      <h2 className="text-xl font-semibold tracking-tight">{action.title}</h2>
      <p className="text-muted-foreground max-w-prose text-sm">{action.why}</p>

      {action.href ? (
        <div>
          <Button nativeButton={false} render={<Link href={action.href} />}>
            Start
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
