import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { LandingPage } from "./LandingPage";

/**
 * The front door.
 *
 * `/` is the landing page and the waitlist; the workspace picker that used to
 * live here moved to `/start`. There are no accounts yet, so nothing about the
 * app is reachable by signing in — the split is simply between someone finding
 * out what this is and someone using it.
 */

/**
 * Structured data, kept deliberately thin.
 *
 * `SoftwareApplication` also accepts `offers` and `aggregateRating`, and both
 * are left out because both would be invented: there is no price yet, and
 * nobody has finished a project with this. A rating nobody gave is the kind of
 * thing that gets a site penalised, and it would contradict every other surface
 * in the product, which says plainly what has not happened yet.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
};

export default function Home() {
  return (
    <>
      {/* Server-rendered, so it is in the initial HTML a crawler reads rather
          than appearing after hydration. */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other injection point, and the value is a local literal serialised by JSON.stringify — no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
