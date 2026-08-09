import { Shell } from "../shell";

/**
 * The work page.
 *
 * Workspace and canvas are two views of this one page, not two destinations,
 * so neither appears in the top nav. They are real routes rather than a
 * client-side toggle: a view you are looking at should be a URL you can send
 * someone, and it keeps the page server-rendered.
 *
 * The tab bar itself lives in each view, not here — see `views.tsx`.
 */
export default function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Shell here="/work" bleed>
      {children}
    </Shell>
  );
}
