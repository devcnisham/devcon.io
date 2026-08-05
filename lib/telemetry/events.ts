/**
 * Event taxonomy and append-only local store.
 *
 * This is product data, not marketing analytics: per-step drop-off is what
 * ranks the catalog fix list. That's why it lands in a table we own rather
 * than a vendor — the improvement loop must not depend on someone's export
 * API.
 *
 * Deliberately anonymous. There are no accounts, so there is no user to
 * identify, and adding one here later should be a decision rather than an
 * accident.
 */

export type EventType =
  | "plan_generated"
  /** This step became the active one. */
  | "step_reached"
  /** The user opened its detail or prompt. */
  | "step_opened"
  /**
   * The prompt was copied. SEPARATE from step_completed on purpose — the gap
   * between the two is the single most diagnostic signal in the product. A
   * high copy rate with a low completion rate means the prompt itself failed,
   * which is invisible if you only record completions.
   */
  | "prompt_copied"
  | "step_completed"
  | "step_uncompleted"
  | "step_stuck"
  | "step_skipped"
  /** Someone checked the subtraction. Trust signal. */
  | "drawer_expanded"
  /** A hidden step was un-hidden — an automatic catalog bug report. */
  | "step_unhidden"
  | "replan_applied"
  /** North star: reached the track's definition of shipped. */
  | "shipped";

export interface DevconEvent {
  id: string;
  ts: number;
  /** Per browser session. Resets on reload; groups one sitting together. */
  session: string;
  /** Per project, so events survive across sessions without an account. */
  project: string;
  type: EventType;
  stepId?: string;
  /** Small scalars only — never free text, never anything identifying. */
  meta?: Record<string, string | number | boolean>;
}

const KEY = "devcon.events";
/** Bounded so a long session can't fill localStorage and start throwing. */
const MAX_EVENTS = 5000;

/**
 * Storage behind a narrow interface, so the swap to a server table is one
 * file rather than a hunt through components. Same reasoning as PlanStore.
 */
export interface EventStore {
  append(event: DevconEvent): void;
  all(): DevconEvent[];
  clear(): void;
}

function newId(): string {
  return `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export class LocalEventStore implements EventStore {
  append(event: DevconEvent): void {
    if (typeof window === "undefined") return;
    const events = this.all();
    events.push(event);
    // Drop oldest first — recent behaviour is what ranks the fix list.
    const trimmed =
      events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      // Quota or private mode. Losing telemetry must never break the app.
    }
  }

  all(): DevconEvent[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as DevconEvent[]) : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  }
}

export const eventStore: EventStore = new LocalEventStore();

/** One id per page load, so a sitting can be told from a return visit. */
let sessionId: string | null = null;
function getSession(): string {
  if (!sessionId) sessionId = `s_${Math.random().toString(36).slice(2, 10)}`;
  return sessionId;
}

/**
 * Record an event. Never throws — a telemetry failure must not surface as a
 * broken interaction.
 */
export function track(
  type: EventType,
  project: string,
  stepId?: string,
  meta?: DevconEvent["meta"],
): void {
  try {
    eventStore.append({
      id: newId(),
      ts: Date.now(),
      session: getSession(),
      project,
      type,
      ...(stepId ? { stepId } : {}),
      ...(meta ? { meta } : {}),
    });
  } catch {
    /* never break the app for a metric */
  }
}

/**
 * Fire once per key for the lifetime of the page.
 *
 * React StrictMode double-invokes effects in development, which double-counted
 * `plan_generated` — the denominator of the north star. A ship rate reading
 * half its true value is worse than no ship rate, because it looks credible.
 *
 * Module-level so it survives the remount StrictMode performs. Also correct in
 * production for any effect that re-runs on a dependency change.
 */
const fired = new Set<string>();

export function trackOnce(
  key: string,
  type: EventType,
  project: string,
  stepId?: string,
  meta?: DevconEvent["meta"],
): void {
  const dedupeKey = `${project}::${key}`;
  if (fired.has(dedupeKey)) return;
  fired.add(dedupeKey);
  track(type, project, stepId, meta);
}

/** Newline-delimited JSON — the shape a server table would ingest. */
export function exportEvents(): string {
  return eventStore
    .all()
    .map((e) => JSON.stringify(e))
    .join("\n");
}
