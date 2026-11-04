/**
 * Test stub for the `server-only` package.
 *
 * The real module throws on import so that a client component importing
 * server code fails the build. Vitest has no client/server boundary, so it
 * would throw for every server module under test. The real guarantee is
 * enforced by `next build`, which is the boundary that actually exists.
 */
export {};
