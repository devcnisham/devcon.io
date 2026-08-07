"use client";

import { useEffect, useState } from "react";
import {
  inWaitlist,
  isValidEmail,
  joinWaitlist,
  waitlistCount,
} from "@/lib/waitlist/store";

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
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

  return (
    <main
      className="min-h-screen text-neutral-200"
      style={{
        background: `
          radial-gradient(900px 600px at 12% -5%, rgba(56,132,180,0.12), transparent 60%),
          radial-gradient(800px 500px at 88% 5%, rgba(120,80,180,0.10), transparent 55%),
          #0a0a0b
        `,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10 sm:px-8">
        <header className="flex items-center justify-between">
          <span className="font-mono text-sm tracking-tight text-neutral-300">
            devcon
          </span>
          <span className="font-mono text-xs text-neutral-500">
            {count > 0 ? `${count} on the list` : "early access"}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16">
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Ship the project, not the plan.
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-neutral-400">
            DevCon takes your idea or existing repo and returns the short,
            ordered sequence of steps to actually ship it — and hides
            everything that doesn&apos;t apply, with a reason attached.
          </p>

          <ul className="mt-8 max-w-xl space-y-2.5 text-[15px] text-neutral-400">
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
              <span>
                One engine, three contexts — academic, competition,
                commercial.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
              <span>
                Each step comes with a context-rich prompt to paste into your
                coding agent.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
              <span>
                Anti-steps tell you what <em>not</em> to do — shown loudly,
                not hidden.
              </span>
            </li>
          </ul>

          <form
            onSubmit={handleSubmit}
            className="mt-10 max-w-xl"
            noValidate
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
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
                disabled={status === "submitting" || alreadyOnList}
                aria-label="Email address"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-[15px] text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "submitting" || alreadyOnList}
                className="shrink-0 rounded-xl border border-white/15 bg-white px-5 py-3 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                className={`mt-3 text-sm ${
                  status === "error" ? "text-amber-300/90" : "text-emerald-300/90"
                }`}
                role={status === "error" ? "alert" : "status"}
              >
                {message}
              </p>
            ) : null}
          </form>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-6 text-xs text-neutral-500">
          <span>
            Early access. We&apos;ll email when invites open — no spam, no
            newsletter.
          </span>
          {/* /start, not /canvas — the picker is where a returning project is
              reopened, and the canvas with no project loaded is just an empty
              state telling you to go and pick one. */}
          <a
            href="/start"
            className="text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-200 hover:underline"
          >
            Already have access? Open the app →
          </a>
        </footer>
      </div>
    </main>
  );
}