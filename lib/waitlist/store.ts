/**
 * Browser-local waitlist. No backend yet — same shape a row in a future table
 * will hold, only the storage differs. Deduplicated by lowercased email.
 */

export interface WaitlistEntry {
  email: string;
  /** Normalised key (trimmed + lowercased). */
  key: string;
  createdAt: number;
}

const KEY = "devcon.waitlist";

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function listWaitlist(): WaitlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // `JSON.parse("null")` succeeds, so the catch below never fires for it and
    // the value escapes as `null` — then the first `.some()` on it throws from
    // inside the form's submit handler. Anything at this key that isn't ours
    // is treated as no list, which is what a corrupt one is worth.
    return Array.isArray(parsed) ? (parsed as WaitlistEntry[]) : [];
  } catch {
    return [];
  }
}

export function inWaitlist(email: string): boolean {
  const key = normalise(email);
  if (!key) return false;
  return listWaitlist().some((e) => e.key === key);
}

/**
 * Returns the entry on success, or an error string describing why not.
 * Email must be valid and not already on the list.
 */
export function joinWaitlist(email: string): WaitlistEntry | string {
  const trimmed = email.trim();
  if (!isValidEmail(trimmed)) return "That doesn't look like an email address.";
  const key = normalise(trimmed);
  if (inWaitlist(key)) return "You're already on the list.";
  const entry: WaitlistEntry = { email: trimmed, key, createdAt: Date.now() };
  const all = listWaitlist();
  all.push(entry);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  }
  return entry;
}

export function waitlistCount(): number {
  return listWaitlist().length;
}
