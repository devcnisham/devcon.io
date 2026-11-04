"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import {
  TECHNOLOGY_CATEGORIES,
  searchTechnologies,
  toggleTechnology,
  type Technology,
} from "@/features/project/lib/technologies";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<(typeof TECHNOLOGY_CATEGORIES)[number], string> =
  {
    language: "Languages",
    frontend: "Frontend",
    backend: "Backend",
    database: "Data",
    styling: "Styling",
    testing: "Testing",
    infrastructure: "Infrastructure",
  };

export function TechnologyPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const matches = searchTechnologies(query);

  const grouped = TECHNOLOGY_CATEGORIES.map((category) => ({
    category,
    items: matches.filter((tech) => tech.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search technologies"
          aria-label="Search technologies"
          className="pl-8"
        />
      </div>

      {selected.length > 0 ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {selected.length} selected
        </p>
      ) : null}

      {grouped.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing matches “{query}”. You can add it later from project settings.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {grouped.map(({ category, items }) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((tech: Technology) => {
                const isSelected = selected.includes(tech.id);

                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() =>
                      onChange(toggleTechnology(selected, tech.id))
                    }
                    aria-pressed={isSelected}
                    className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={cn("cursor-pointer gap-1 py-1", "select-none")}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                      {tech.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
