import { LandingPage } from "./LandingPage";

/**
 * The front door.
 *
 * `/` is the landing page and the waitlist; the workspace picker that used to
 * live here moved to `/start`. There are no accounts yet, so nothing about the
 * app is reachable by signing in — the split is simply between someone finding
 * out what this is and someone using it.
 */
export default function Home() {
  return <LandingPage />;
}
