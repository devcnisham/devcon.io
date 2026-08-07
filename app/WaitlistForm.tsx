"use client";

import { useEffect, useState } from "react";
import {
  isValidEmail,
  joinWaitlist,
  waitlistCount,
} from "@/lib/waitlist/store";

/**
 * The waitlist form, split out of the page.
 *
 * This is the only interactive thing on `/`, so it is the only part that needs
 * to be a client component. Everything around it is now server-rendered — the
 * page used to be `"use client"` end to end, which meant a headline and one
 * input cost the full hydration path.
 *
 * Behaviour and copy are unchanged on purpose. The store is still browser
 * `localStorage`, and the count below is still per-origin — see HANDOFF.md,
 * where both are recorded as known and deliberately left.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const [count, setCount] = useState(0);

  // localStorage is client-only.
  useEffect(() => {
    setCount(waitlistCount());
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("Enter a valid email so we can reach you.");
      return;
    }

    setStatus("submitting");
    const result = joinWaitlist(email);
    if (typeof result === "string") {
      setStatus("error");
      setMessage(result);
      return;
    }

    setStatus("done");
    setMessage("You're in. We'll email when access opens.");
    setCount(waitlistCount());
    setAlreadyOnList(true);
    setEmail("");
  };

  const busy = status === "submitting" || alreadyOnList;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* A real label, not a placeholder doing double duty — the placeholder is
          an example address and disappears the moment anyone types. */}
      <label
        htmlFor="waitlist-email"
        className="block font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400"
      >
        Email
      </label>

      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status !== "idle") {
              setStatus("idle");
              setMessage(null);
            }
          }}
          placeholder="you@domain.com"
          disabled={busy}
          aria-invalid={status === "error"}
          aria-describedby={message ? "waitlist-message" : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 text-[15px] text-neutral-100 transition-colors placeholder:text-neutral-500 focus:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 shrink-0 rounded-lg bg-neutral-100 px-5 text-[15px] font-medium text-neutral-950 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {alreadyOnList
            ? "On the list"
            : status === "submitting"
              ? "Joining…"
              : "Join the waitlist"}
        </button>
      </div>

      {message ? (
        <p
          id="waitlist-message"
          className={`mt-2.5 text-[13px] ${
            status === "error" ? "text-amber-300" : "text-emerald-300"
          }`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      <p className="mt-3 font-mono text-[11px] text-neutral-400">
        {count > 0 ? `${count} on the list` : "Early access"} · no spam, no
        newsletter
      </p>
    </form>
  );
}
