import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading state for every auth screen. */
export default function AuthLoading() {
  return (
    <div
      className="flex flex-col gap-6 rounded-xl border p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
