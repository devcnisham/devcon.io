/**
 * Public surface of the project feature.
 *
 * Phase 0.4: the wizard, its step machine, the technology catalogue,
 * validation, and persistence (Task 9) are complete and tested. The wizard
 * saves into the user's workspace and the settings form updates it; the
 * projects-list read path is still Task 11. Repository selection waits on the
 * GitHub integration (build-order step 15).
 */

export { ProjectWizard } from "./components/project-wizard";
export { TechnologyPicker } from "./components/technology-picker";
export { ProjectSettingsForm } from "./components/project-settings-form";

export {
  WIZARD_STEPS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  canAdvance,
  initialDraft,
  nextStep,
  previousStep,
  progress,
  stepsFor,
  NAME_MIN,
  NAME_MAX,
  DESCRIPTION_MAX,
  type WizardStep,
  type ProjectDraft,
  type ProjectType,
  type ProjectSource,
  type ProjectStatus,
  type ProjectVisibility,
} from "./lib/wizard";

export {
  TECHNOLOGIES,
  TECHNOLOGY_CATEGORIES,
  findTechnology,
  searchTechnologies,
  suggestedFor,
  toggleTechnology,
  type Technology,
  type TechnologyCategory,
} from "./lib/technologies";

export {
  projectSettingsSchema,
  projectNameSchema,
  projectDescriptionSchema,
  type ProjectSettingsValues,
} from "./lib/schemas";

export {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_VISIBILITY_LABELS,
  type Project,
} from "./types";
