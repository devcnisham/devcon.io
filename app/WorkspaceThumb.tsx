"use client";

/**
 * Synthetic canvas preview for a workspace card.
 *
 * Real screenshots need the canvas to have been rendered and captured, which
 * needs the backend. This draws a deterministic mock of the actual canvas —
 * same wallpaper, node shapes in the same states — from the workspace id, so
 * cards look distinct without pretending to be a real capture.
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function WorkspaceThumb({ id }: { id: string }) {
  const seed = hash(id);
  const rand = (n: number, i: number) => ((seed >> (i * 3)) % n) + 1;

  const rows = [
    { count: 2, w: 30 },
    { count: 1, w: 38 },
    { count: 1, w: 38 },
    { count: 2, w: 30 },
    { count: 3, w: 22 },
    { count: 2, w: 30 },
  ];

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `
          radial-gradient(120% 90% at 15% 0%, rgba(56,132,180,0.38), transparent 60%),
          radial-gradient(100% 80% at 85% 15%, rgba(120,80,180,0.28), transparent 55%),
          radial-gradient(90% 100% at 60% 100%, rgba(20,120,120,0.28), transparent 60%),
          linear-gradient(160deg, #0b1622 0%, #0a1118 45%, #090c12 100%)
        `,
      }}
    >
      {/* Dot grid, matching the canvas. */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-[6px] px-4">
        {rows.map((row, r) => (
          <div key={`r${r}`} className="flex gap-[6px]">
            {Array.from({ length: row.count }).map((_, c) => {
              const active = r === 0 && c === 0;
              const done = r < rand(3, c + r);
              return (
                <span
                  key={`c${c}`}
                  className={`h-[9px] rounded-[3px] border ${
                    active
                      ? "border-amber-400/80 bg-amber-400/25"
                      : done
                        ? "border-white/10 bg-white/[0.07]"
                        : "border-white/15 bg-white/[0.12]"
                  }`}
                  style={{ width: `${row.w}px` }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Docs panel edge, right side. */}
      <div className="absolute inset-y-2 right-2 w-[34px] rounded-[4px] border border-white/12 bg-neutral-950/70" />
    </div>
  );
}
