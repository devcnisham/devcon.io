import type { Architecture, Detection } from "@/features/codebase/lib/detect";
import { confidenceLabel } from "@/features/codebase/lib/detect";
import { Badge } from "@/components/ui/badge";

function ConfidenceBadge({ score }: { score: number }) {
  const label = confidenceLabel(score);

  return (
    <Badge
      variant={score >= 0.65 ? "default" : "outline"}
      title={`Confidence ${Math.round(score * 100)}%`}
    >
      {label}
    </Badge>
  );
}

function DetectionList({
  title,
  detections,
  empty,
}: {
  title: string;
  detections: Detection[];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </p>

      {detections.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {detections.map((detection) => (
            <li key={detection.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{detection.name}</span>
                {detection.version ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    {detection.version}
                  </span>
                ) : null}
                <ConfidenceBadge score={detection.confidence} />
                {detection.configFiles?.length ? (
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {detection.configFiles[0]}
                  </Badge>
                ) : null}
              </div>
              <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                {detection.evidence.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * What the project appears to be, and why.
 *
 * Evidence is always shown next to a conclusion. A developer who disagrees can
 * see exactly which signal produced it, rather than being told to trust a
 * label.
 */
export function DetectionSummary({
  frameworks,
  features,
  architecture,
  runtimes = [],
}: {
  frameworks: Detection[];
  features: Detection[];
  architecture: Architecture;
  runtimes?: Detection[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <DetectionList
        title={
          runtimes.length > 1
            ? `Runtimes — primary: ${runtimes[0].name}`
            : "Runtime"
        }
        detections={runtimes}
        empty="No runtime recognised — no lockfile or project file was found."
      />

      <DetectionList
        title="Frameworks"
        detections={frameworks}
        empty="No framework recognised from the dependencies or layout."
      />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Architecture
        </p>
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {architecture.style === "monorepo"
                ? "Monorepo"
                : architecture.style === "single-app"
                  ? "Single application"
                  : "Unclear"}
            </span>
            {architecture.layering !== "unknown" ? (
              <Badge variant="secondary">{architecture.layering}</Badge>
            ) : null}
            <ConfidenceBadge score={architecture.confidence} />
          </div>
          {architecture.evidence.length > 0 ? (
            <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
              {architecture.evidence.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <DetectionList
        title="Features"
        detections={features}
        empty="No recognisable features yet — this looks like an early-stage project."
      />
    </div>
  );
}
