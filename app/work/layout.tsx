/**
 * The work page owns the whole viewport.
 *
 * No app header here on purpose — the only chrome is the floating view switch,
 * which each view renders itself (see `views.tsx`). Everything else is ground:
 * a layered gradient and a dot grid, so the surface reads as a place to put
 * things rather than as a page.
 */
export default function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      /**
       * Locked to the viewport only where that makes sense.
       *
       * `h-dvh overflow-hidden` at every width turned a phone into two
       * independent 374px scroll boxes: the rail took half the screen and the
       * conditions list had 2832px of content trapped in the other half. Below
       * `lg` the page scrolls as one document instead.
       */
      className="relative flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden"
      style={{
        /**
         * Three washes over a lifted navy, not a flat near-black.
         *
         * The first pass used the same hues at roughly half these opacities
         * over #0a0e14 and rendered as plain black — on a dark surface a wash
         * has to be far stronger than it looks in the value to survive.
         */
        background: `
          radial-gradient(1000px 700px at 14% 0%, rgba(46,104,168,0.55), transparent 64%),
          radial-gradient(820px 560px at 92% -4%, rgba(116,88,182,0.42), transparent 60%),
          radial-gradient(1200px 780px at 40% 106%, rgba(28,140,150,0.45), transparent 62%),
          #0b1119
        `,
      }}
    >
      {/* Ground. Sits above the gradient and below everything else. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {children}
    </div>
  );
}
