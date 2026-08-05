"use client";

import { useCallback, useEffect, useState } from "react";
import type { FileSource } from "@/lib/scan/source";
import type { RepoDigest } from "@/lib/scan/types";
import { type Feature, featureModule } from "./modules/feature";
import { detectorInputFrom, scanRegistry } from "./scan";
import { LocalRegistryStore } from "./store";
import { SyncEngine, localOnlyTransport } from "./sync";

/**
 * The registry, wired to a project.
 *
 * The only place the UI touches persistence, scanning or sync. The component
 * gets entries and four callbacks and knows nothing about how any of it works —
 * which is what lets the same component serve a second module later.
 */

const store = new LocalRegistryStore();
const sync = new SyncEngine(store, localOnlyTransport);

export function useRegistry(project: string) {
  const [entries, setEntries] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setEntries(await store.list<Feature>(project, "feature"));
  }, [project]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Write, then reload.
   *
   * Optimistic: the local list updates before the store round-trip so typing in
   * the detail panel doesn't lag. The store is the truth, so the reload after
   * corrects anything the optimistic guess got wrong — a revision bump, or a
   * write that was a no-op because nothing actually changed.
   */
  const change = useCallback(
    async (entry: Feature) => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      const problems = featureModule.validate(entry);
      if (problems.length) {
        setWarnings((w) => [...w, `${entry.id}: ${problems.join("; ")}`]);
        await reload();
        return;
      }
      const stored = await store.put(project, entry, "user");
      sync.enqueue(project, stored);
      await reload();
    },
    [project, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      await store.remove(project, "feature", id, "user");
      await reload();
    },
    [project, reload],
  );

  /**
   * Scan a source and merge the findings.
   *
   * Anything already reviewed keeps its review state. Without that a re-scan
   * would resurrect every dismissed suggestion, and the review would be work
   * the user has to redo on every scan.
   */
  const scan = useCallback(
    async (source: FileSource, digest: RepoDigest) => {
      setLoading(true);
      try {
        const result = await scanRegistry(source, detectorInputFrom(digest));
        const existing = await store.list<Feature>(project, "feature");
        const reviewed = new Map(
          existing
            .filter((e) => e.origin === "detected" && e.review !== "suggested")
            .map((e) => [e.id, e]),
        );
        // A manual entry is never touched by a scan, whatever the detector saw.
        const manual = new Set(
          existing.filter((e) => e.origin === "manual").map((e) => e.id),
        );

        const toWrite = result.entries
          .filter((e) => !manual.has(e.id))
          .map((e) => {
            const prior = reviewed.get(e.id);
            return prior
              ? { ...e, review: prior.review, revision: prior.revision }
              : e;
          });

        await store.putMany(project, toWrite, "scanner");
        setWarnings(result.warnings);
        await reload();
      } finally {
        setLoading(false);
      }
    },
    [project, reload],
  );

  return { entries, loading, warnings, change, remove, scan, reload };
}
