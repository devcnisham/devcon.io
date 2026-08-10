/** What an empty surface says. One line, no instructions it cannot honour. */
export function Empty({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
      {label}
    </p>
  );
}
