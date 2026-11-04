"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FolderGit2, FolderPlus } from "lucide-react";
import { AuthAlert } from "@/features/auth";
import { createProjectAction } from "@/features/project/lib/actions";
import { TechnologyPicker } from "@/features/project/components/technology-picker";
import {
  DESCRIPTION_MAX,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  canAdvance,
  initialDraft,
  nextStep,
  previousStep,
  progress,
  type ProjectDraft,
  type WizardStep,
} from "@/features/project/lib/wizard";
import { suggestedFor } from "@/features/project/lib/technologies";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEP_TITLES: Record<WizardStep, string> = {
  basics: "Name your project",
  type: "What kind of project is it?",
  stack: "What is it built with?",
  source: "New or existing?",
  repository: "Choose a repository",
  visibility: "Who can see it?",
  review: "Review",
};

function OptionCard({
  selected,
  onClick,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "focus-visible:ring-ring flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      {description ? (
        <span className="text-muted-foreground text-xs">{description}</span>
      ) : null}
    </button>
  );
}

export function ProjectWizard({ workspaceId }: { workspaceId: string }) {
  const [draft, setDraft] = React.useState<ProjectDraft>(initialDraft);
  const [step, setStep] = React.useState<WizardStep>("basics");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState(false);

  const update = (patch: Partial<ProjectDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const { current, total } = progress(step, draft.source);

  async function goNext() {
    const result = canAdvance(step, draft);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);

    if (step !== "review") {
      setStep(nextStep(step, draft.source));
      return;
    }

    // Final step: persist. canAdvance("type") guaranteed a type earlier in
    // the walk, so a missing type here is a state-machine bug, not a user
    // error — surface it as one anyway rather than crash the save.
    if (!draft.type) {
      setError("Choose a project type");
      return;
    }

    setSaving(true);
    const outcome = await createProjectAction({
      workspaceId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: draft.type,
      visibility: draft.visibility,
      status: draft.status,
    });
    setSaving(false);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setCreated(true);
  }

  function goBack() {
    setError(null);
    setStep(previousStep(step, draft.source));
  }

  if (created) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Project created
          </h1>
          <p className="text-muted-foreground text-sm">
            “{draft.name}” was saved to your workspace.
          </p>
        </div>
        <div>
          <Button nativeButton={false} render={<Link href="/projects" />}>
            View projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            {STEP_TITLES[step]}
          </h1>
          <p className="text-muted-foreground text-sm">
            Step {current} of {total}
          </p>
        </div>
        <Progress value={(current / total) * 100}>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </div>

      {error ? <AuthAlert variant="error" message={error} /> : null}

      {step === "basics" ? (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="project-name">Project name</FieldLabel>
            <Input
              id="project-name"
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="devstep"
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-description">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="project-description"
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              rows={3}
              placeholder="What are you building?"
            />
            <FieldDescription>
              {draft.description.length} / {DESCRIPTION_MAX}
            </FieldDescription>
          </Field>
        </div>
      ) : null}

      {step === "type" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {PROJECT_TYPES.map((type) => (
            <OptionCard
              key={type}
              selected={draft.type === type}
              onClick={() =>
                update({
                  type,
                  technologies:
                    draft.technologies.length === 0
                      ? suggestedFor(type)
                      : draft.technologies,
                })
              }
              title={PROJECT_TYPE_LABELS[type]}
            />
          ))}
        </div>
      ) : null}

      {step === "stack" ? (
        <TechnologyPicker
          selected={draft.technologies}
          onChange={(technologies) => update({ technologies })}
        />
      ) : null}

      {step === "source" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionCard
            selected={draft.source === "new"}
            onClick={() => update({ source: "new", repository: null })}
            title="Start something new"
            description="An empty project. devstep guides you from the first commit."
            icon={<FolderPlus className="size-4" />}
          />
          <OptionCard
            selected={draft.source === "existing"}
            onClick={() => update({ source: "existing" })}
            title="Import an existing project"
            description="Connect a repository so devstep can read what is already there."
            icon={<FolderGit2 className="size-4" />}
          />
        </div>
      ) : null}

      {step === "repository" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Repository selection needs the GitHub integration, which is not
            connected yet. Enter one manually for now.
          </p>
          <Field>
            <FieldLabel htmlFor="repository">Repository</FieldLabel>
            <Input
              id="repository"
              value={draft.repository ?? ""}
              onChange={(event) => update({ repository: event.target.value })}
              placeholder="owner/repository"
            />
          </Field>
        </div>
      ) : null}

      {step === "visibility" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionCard
            selected={draft.visibility === "private"}
            onClick={() => update({ visibility: "private" })}
            title="Private"
            description="Only you can see this project."
          />
          <OptionCard
            selected={draft.visibility === "workspace"}
            onClick={() => update({ visibility: "workspace" })}
            title="Workspace"
            description="Everyone in the workspace can see it."
          />
        </div>
      ) : null}

      {step === "review" ? (
        <dl className="divide-border divide-y rounded-lg border text-sm">
          {[
            ["Name", draft.name],
            ["Description", draft.description || "—"],
            ["Type", draft.type ? PROJECT_TYPE_LABELS[draft.type] : "—"],
            ["Technologies", draft.technologies.join(", ") || "—"],
            ["Source", draft.source === "new" ? "New project" : "Existing"],
            ["Repository", draft.repository || "—"],
            ["Visibility", draft.visibility],
            ["Status", draft.status],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4 px-3 py-2">
              <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === "basics" || saving}
          type="button"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {/*
          Deliberately not disabled (except while saving): a disabled button
          gives no reason. Clicking runs the step's rule and surfaces exactly
          what is missing, which is announced by the alert above.
        */}
        <Button
          onClick={goNext}
          type="button"
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving…" : step === "review" ? "Create project" : "Continue"}
          {step === "review" || saving ? null : (
            <ArrowRight className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
