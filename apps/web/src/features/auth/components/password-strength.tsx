"use client";

import { passwordStrength } from "@/features/auth/lib/schemas";
import { cn } from "@/lib/utils";

const TONE = [
  "bg-muted",
  "bg-destructive",
  "bg-amber-500",
  "bg-amber-400",
  "bg-emerald-500",
] as const;

/** Four-segment strength meter. Advisory only — the schema does the enforcing. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const { score, label } = passwordStrength(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex gap-1"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label={`Password strength: ${label}`}
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              segment <= score ? TONE[score] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
