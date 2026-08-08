import type { RegistryEntry } from "./types";

/**
 * Search, filter and sort for any registry module.
 *
 * Pure functions over entries, deliberately outside React. Three reasons: the
 * CLI needs the same filtering the dashboard has, this is the part with the
 * fiddly edge cases and it should be tested without rendering anything, and a
 * second module gets it for free.
 */

export type SortKey =
  | "name"
  | "status"
  | "updatedAt"
  | "createdAt"
  | "priority";
export type SortDirection = "asc" | "desc";

export interface RegistryQuery {
  text: string;
  /** Empty means no constraint, NOT "match nothing". */
  statuses: string[];
  origins: string[];
  categories: string[];
  tags: string[];
  owners: string[];
  sort: SortKey;
  direction: SortDirection;
}

export const EMPTY_QUERY: RegistryQuery = {
  text: "",
  statuses: [],
  origins: [],
  categories: [],
  tags: [],
  owners: [],
  sort: "updatedAt",
  direction: "desc",
};

type Queryable = RegistryEntry & {
  status?: string;
  priority?: string;
};

/**
 * Match against everything a person might type.
 *
 * Substring, not fuzzy. Fuzzy matching on a list this size returns confident
 * nonsense — searching "auth" should not surface "Analytics" because both
 * contain the letters.
 */
function matchesText(entry: Queryable, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return [
    entry.name,
    entry.id,
    entry.description ?? "",
    entry.category ?? "",
    entry.owner ?? "",
    ...entry.tags,
  ].some((field) => field.toLowerCase().includes(q));
}

const PRIORITY_ORDER = ["low", "medium", "high", "critical"];

function compare(
  a: Queryable,
  b: Queryable,
  key: SortKey,
  statuses: readonly string[],
): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "status":
      // By lifecycle position, not alphabetically — "building" before
      // "completed" is the useful order, and "b" before "c" is a coincidence
      // that stops being true the moment a status is renamed.
      return (
        statuses.indexOf(a.status ?? "") - statuses.indexOf(b.status ?? "")
      );
    case "priority":
      return (
        PRIORITY_ORDER.indexOf(a.priority ?? "") -
        PRIORITY_ORDER.indexOf(b.priority ?? "")
      );
    case "createdAt":
      return a.createdAt.localeCompare(b.createdAt);
    default:
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

export function runQuery<T extends Queryable>(
  entries: T[],
  query: RegistryQuery,
  statuses: readonly string[] = [],
): T[] {
  const filtered = entries.filter((e) => {
    if (!matchesText(e, query.text.trim())) return false;
    if (query.statuses.length && !query.statuses.includes(e.status ?? ""))
      return false;
    if (query.origins.length && !query.origins.includes(e.origin)) return false;
    if (
      query.categories.length &&
      !query.categories.includes(e.category ?? "")
    ) {
      return false;
    }
    if (query.owners.length && !query.owners.includes(e.owner ?? ""))
      return false;
    // Tags are OR within the filter: picking two tags widens the result, which
    // is what a person means by clicking a second one.
    if (query.tags.length && !query.tags.some((t) => e.tags.includes(t)))
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const primary = compare(a, b, query.sort, statuses);
    // Tie-break on id so the order is stable. Without it, two entries with the
    // same status reorder between renders and the list flickers.
    return primary !== 0 ? primary : a.id.localeCompare(b.id);
  });

  return query.direction === "desc" ? sorted.reverse() : sorted;
}

/** Distinct values for the filter controls, in a stable order. */
export function facets<T extends Queryable>(entries: T[]) {
  const collect = (pick: (e: T) => string | undefined) =>
    [
      ...new Set(entries.map(pick).filter((v): v is string => Boolean(v))),
    ].sort();

  return {
    categories: collect((e) => e.category),
    owners: collect((e) => e.owner),
    tags: [...new Set(entries.flatMap((e) => e.tags))].sort(),
    statuses: collect((e) => e.status),
  };
}

/**
 * Group entries by where they came from.
 *
 * The dashboard shows these separately because they mean different things: a
 * suggestion is a question, an accepted entry is an answer, and a manual one is
 * a decision. Flattening them into one list is what makes a registry feel
 * unreliable.
 */
export function byOrigin<T extends Queryable>(entries: T[]) {
  return {
    manual: entries.filter((e) => e.origin === "manual"),
    declared: entries.filter((e) => e.origin === "declared"),
    annotated: entries.filter((e) => e.origin === "annotated"),
    suggested: entries.filter(
      (e) => e.origin === "detected" && e.review === "suggested",
    ),
    accepted: entries.filter(
      (e) => e.origin === "detected" && e.review === "accepted",
    ),
    dismissed: entries.filter(
      (e) => e.origin === "detected" && e.review === "dismissed",
    ),
  };
}
