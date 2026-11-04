"use client";

import * as React from "react";
import { GitBranch, Lock, Search, Star } from "lucide-react";
import type { Repository } from "@/features/integrations/github/lib/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";

  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Repository list, search, selection, and branch choice.
 *
 * Presentational: repositories and branches are passed in, so this renders
 * identically whether they came from GitHub or a test.
 */
export function RepositoryPicker({
  repositories,
  branches,
  selected,
  branch,
  onSelect,
  onBranchChange,
  onImport,
  busy,
}: {
  repositories: Repository[];
  branches: string[];
  selected: Repository | null;
  branch: string | null;
  onSelect: (repository: Repository) => void;
  onBranchChange: (branch: string) => void;
  onImport: () => void;
  busy?: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? repositories.filter((repository) =>
        repository.fullName.toLowerCase().includes(needle)
      )
    : repositories;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search repositories"
          aria-label="Search repositories"
          className="pl-8"
        />
      </div>

      {matches.length === 0 ? (
        <Empty>
          <EmptyTitle>No repositories match</EmptyTitle>
          <EmptyDescription>
            {repositories.length === 0
              ? "No repositories were returned for this account."
              : `Nothing matches “${query}”.`}
          </EmptyDescription>
        </Empty>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {matches.map((repository) => {
            const isSelected = selected?.id === repository.id;

            return (
              <li key={repository.id}>
                <button
                  type="button"
                  onClick={() => onSelect(repository)}
                  aria-pressed={isSelected}
                  disabled={!repository.canRead}
                  className={cn(
                    "focus-visible:ring-ring w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {repository.fullName}
                    </span>
                    {repository.isPrivate ? (
                      <Lock className="text-muted-foreground size-3" />
                    ) : null}
                    {!repository.canRead ? (
                      <Badge variant="outline">No read access</Badge>
                    ) : null}
                  </span>

                  <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
                    {repository.language ? (
                      <span>{repository.language}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3" />
                      {repository.stars}
                    </span>
                    <span>{Math.round(repository.sizeKb / 1024)} MB</span>
                    <span>updated {relativeTime(repository.pushedAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-sm font-medium">{selected.fullName}</p>

          <label className="flex items-center gap-2 text-sm">
            <GitBranch className="text-muted-foreground size-4" />
            <span className="sr-only">Branch</span>
            <NativeSelect
              value={branch ?? selected.defaultBranch}
              onChange={(event) => onBranchChange(event.target.value)}
              className="max-w-56"
            >
              {(branches.length > 0 ? branches : [selected.defaultBranch]).map(
                (name) => (
                  <option key={name} value={name}>
                    {name}
                    {name === selected.defaultBranch ? " (default)" : ""}
                  </option>
                )
              )}
            </NativeSelect>
          </label>

          <div>
            <Button onClick={onImport} disabled={busy} aria-busy={busy}>
              {busy ? "Scanning…" : "Import and scan"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
