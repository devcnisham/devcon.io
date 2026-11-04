/**
 * The project-creation wizard, as a pure state machine.
 *
 * Kept free of React and I/O so the step order and the "can I continue?" rules
 * are testable on their own. The component renders whatever this says.
 *
 * The step list is not fixed: an existing project needs a repository, a new
 * one does not, so the path branches on `source`.
 */

export const WIZARD_STEPS = [
  "basics",
  "type",
  "stack",
  "source",
  "repository",
  "visibility",
  "review",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export type ProjectSource = "new" | "existing";
export type ProjectVisibility = "private" | "workspace";
export type ProjectStatus = "active" | "paused" | "archived";

export const PROJECT_TYPES = [
  "saas",
  "website",
  "web-app",
  "api",
  "mobile-app",
  "desktop-app",
  "ai-app",
  "ecommerce",
  "other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  saas: "SaaS",
  website: "Website",
  "web-app": "Web app",
  api: "API",
  "mobile-app": "Mobile app",
  "desktop-app": "Desktop app",
  "ai-app": "AI app",
  ecommerce: "E-commerce",
  other: "Other",
};

export type ProjectDraft = {
  name: string;
  description: string;
  type: ProjectType | null;
  technologies: string[];
  source: ProjectSource;
  repository: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
};

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 500;

export function initialDraft(): ProjectDraft {
  return {
    name: "",
    description: "",
    type: null,
    technologies: [],
    source: "new",
    repository: null,
    visibility: "private",
    status: "active",
  };
}

/** The steps this draft actually walks through. */
export function stepsFor(source: ProjectSource): WizardStep[] {
  return WIZARD_STEPS.filter(
    (step) => step !== "repository" || source === "existing"
  );
}

export type AdvanceResult = { ok: true } | { ok: false; reason: string };

/** Whether the draft satisfies the current step. */
export function canAdvance(
  step: WizardStep,
  draft: ProjectDraft
): AdvanceResult {
  switch (step) {
    case "basics": {
      const name = draft.name.trim();
      if (name.length < NAME_MIN) {
        return {
          ok: false,
          reason: `Give the project a name of at least ${NAME_MIN} characters`,
        };
      }
      if (name.length > NAME_MAX) {
        return {
          ok: false,
          reason: `Project name must be ${NAME_MAX} characters or fewer`,
        };
      }
      if (draft.description.length > DESCRIPTION_MAX) {
        return {
          ok: false,
          reason: `Description must be ${DESCRIPTION_MAX} characters or fewer`,
        };
      }
      return { ok: true };
    }

    case "type":
      return draft.type
        ? { ok: true }
        : { ok: false, reason: "Choose a project type" };

    case "stack":
      return draft.technologies.length > 0
        ? { ok: true }
        : { ok: false, reason: "Choose at least one technology" };

    case "repository":
      return draft.repository
        ? { ok: true }
        : { ok: false, reason: "Choose a repository to import" };

    // Source, visibility, and review always have a valid default selected.
    case "source":
    case "visibility":
    case "review":
      return { ok: true };
  }
}

export function nextStep(step: WizardStep, source: ProjectSource): WizardStep {
  const steps = stepsFor(source);
  const index = steps.indexOf(step);

  if (index < 0 || index === steps.length - 1) return step;
  return steps[index + 1];
}

export function previousStep(
  step: WizardStep,
  source: ProjectSource
): WizardStep {
  const steps = stepsFor(source);
  const index = steps.indexOf(step);

  if (index <= 0) return step;
  return steps[index - 1];
}

export function progress(
  step: WizardStep,
  source: ProjectSource
): { current: number; total: number } {
  const steps = stepsFor(source);

  return { current: steps.indexOf(step) + 1, total: steps.length };
}
