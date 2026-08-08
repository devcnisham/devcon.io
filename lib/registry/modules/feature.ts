import {
  nowIso,
  type RegistryEntry,
  type RegistryModule,
  slugify,
} from "../types";

/**
 * The Feature module — the first registry module, and the reference for the
 * ones that follow.
 *
 * Everything specific to features lives here: the lifecycle, the extra fields,
 * the validation. The store, the sync engine and the list UI import nothing
 * from this file. If adding APIs or routes later requires touching those, this
 * abstraction failed and should be fixed rather than worked around.
 */

/** Ordered — this array IS the lifecycle, and the UI renders it in order. */
export const FEATURE_STATUSES = [
  "planned",
  "building",
  "testing",
  "completed",
  "deprecated",
] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export interface Feature extends RegistryEntry {
  module: "feature";
  status: FeatureStatus;
  priority: FeaturePriority;
  /** Free text the developer keeps. Never written by a scan. */
  notes?: string;
}

export function isFeatureStatus(v: unknown): v is FeatureStatus {
  return FEATURE_STATUSES.includes(v as FeatureStatus);
}

export function isFeaturePriority(v: unknown): v is FeaturePriority {
  return FEATURE_PRIORITIES.includes(v as FeaturePriority);
}

/**
 * Status presentation, kept beside the lifecycle rather than in the component.
 *
 * A second module will want the same treatment, and a switch statement buried
 * in JSX is where that stops being possible.
 */
export const FEATURE_STATUS_META: Record<
  FeatureStatus,
  { label: string; icon: string; tone: string }
> = {
  planned: { label: "Planned", icon: "📋", tone: "neutral" },
  building: { label: "Building", icon: "🚧", tone: "amber" },
  testing: { label: "Testing", icon: "⏳", tone: "sky" },
  completed: { label: "Completed", icon: "✅", tone: "emerald" },
  deprecated: { label: "Deprecated", icon: "🗑", tone: "rose" },
};

/** Statuses that mean the work is not finished. Used by the "incomplete" filter. */
export const INCOMPLETE_STATUSES: FeatureStatus[] = [
  "planned",
  "building",
  "testing",
];

export const featureModule: RegistryModule<Feature> = {
  id: "feature",
  label: "Features",
  singular: "feature",
  statuses: FEATURE_STATUSES,

  validate(entry) {
    const problems: string[] = [];
    if (!entry.name.trim()) problems.push("name is empty");
    if (!entry.id.trim()) problems.push("id is empty");
    if (!isFeatureStatus(entry.status)) {
      problems.push(
        `status "${entry.status}" is not one of ${FEATURE_STATUSES.join(", ")}`,
      );
    }
    if (!isFeaturePriority(entry.priority)) {
      problems.push(`priority "${entry.priority}" is not a known priority`);
    }
    if (entry.dependsOn.includes(entry.id)) {
      problems.push("depends on itself");
    }
    // A detected entry without evidence is indistinguishable from a guess, and
    // the review UI has nothing to show the person deciding whether to accept.
    if (entry.origin === "detected" && !entry.evidence?.length) {
      problems.push("detected but carries no evidence");
    }
    if (entry.origin === "detected" && !entry.review) {
      problems.push("detected but has no review state");
    }
    if (entry.origin !== "detected" && entry.review) {
      problems.push("only detected entries carry a review state");
    }
    return problems;
  },

  /**
   * Fill in everything a caller left out.
   *
   * Every entry point — SDK, annotation, config file, detector, the UI form —
   * goes through this, so an entry from a comment is structurally identical to
   * one typed into the dashboard. That is what lets the store and the sync
   * engine stay ignorant of where anything came from.
   */
  hydrate(partial) {
    const at = nowIso();
    const origin = partial.origin ?? "manual";
    return {
      id: partial.id?.trim() || slugify(partial.name),
      module: "feature",
      name: partial.name.trim(),
      description: partial.description,
      category: partial.category,
      tags: partial.tags ?? [],
      owner: partial.owner,
      version: partial.version,
      origin,
      review:
        origin === "detected" ? (partial.review ?? "suggested") : undefined,
      evidence: partial.evidence,
      files: partial.files ?? [],
      dependsOn: partial.dependsOn ?? [],
      status: isFeatureStatus(partial.status) ? partial.status : "planned",
      priority: isFeaturePriority(partial.priority)
        ? partial.priority
        : "medium",
      notes: partial.notes,
      createdAt: partial.createdAt ?? at,
      updatedAt: partial.updatedAt ?? at,
      revision: partial.revision ?? 1,
    };
  },
};
