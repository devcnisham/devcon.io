"use client";

import * as React from "react";
import {
  FolderPlus,
  FolderMinus,
  Pencil,
  Sparkles,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityKind } from "@/features/workspace/types";
import { loadWorkspaceActivityAction } from "@/features/workspace/lib/actions";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const ICONS: Record<ActivityKind, LucideIcon> = {
  "workspace.created": Sparkles,
  "workspace.renamed": Pencil,
  "workspace.deleted": Trash2,
  "project.created": FolderPlus,
  "project.deleted": FolderMinus,
  "member.joined": UserPlus,
};

/**
 * Chronological record of what happened in a workspace. Loads the events
 * itself from loadWorkspaceActivityAction (workspace_activities, newest 50)
 * the moment it mounts with a workspaceId; until then it renders nothing so a
 * loading state never flashes over real data.
 */
export function ActivityFeed({ workspaceId }: { workspaceId: string }) {
  const [events, setEvents] = React.useState<ActivityEvent[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadWorkspaceActivityAction(workspaceId).then((result) => {
      if (cancelled) return;
      // A failed load degrades to the empty state rather than an error wall —
      // the feed is supplementary, and a retry comes free on the next mount.
      setEvents(result.ok && result.data ? result.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (events === null) return null;

  if (events.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Sparkles />
        </EmptyMedia>
        <EmptyTitle>No activity yet</EmptyTitle>
        <EmptyDescription>
          Creating projects, inviting people, and shipping changes all show up
          here.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const Icon = ICONS[event.kind];
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </span>
              {!isLast ? <span className="bg-border w-px flex-1" /> : null}
            </div>
            <div className="flex flex-col gap-0.5 pb-6">
              <p className="text-sm">
                <span className="font-medium">{event.actorName}</span>{" "}
                {event.summary}
              </p>
              <time
                dateTime={event.occurredAt}
                className="text-muted-foreground text-xs"
              >
                {new Date(event.occurredAt).toLocaleString()}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
