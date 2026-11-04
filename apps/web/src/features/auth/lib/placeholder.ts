/**
 * PLACEHOLDER — remove when the auth backend lands.
 *
 * This phase is UI-only: there is no auth client yet. Forms need *something*
 * awaitable so their loading, error, and success states are real and
 * inspectable rather than hypothetical. This stands in for that call.
 *
 * Submitting with the email below throws, which is the only way to see the
 * error state before a real backend exists.
 */
export const DEMO_ERROR_EMAIL = "error@devstep.test";

export const DEMO_ERROR_MESSAGE =
  "We could not complete that request. Check your details and try again.";

export async function submitPlaceholder(values: {
  email?: string;
  [key: string]: unknown;
}): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 900));

  if (values.email?.trim().toLowerCase() === DEMO_ERROR_EMAIL) {
    throw new Error(DEMO_ERROR_MESSAGE);
  }
}
