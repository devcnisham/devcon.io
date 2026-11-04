/**
 * The master switch for auth enforcement.
 *
 * Route protection is built and tested, but stays inert until there is a way
 * to sign in. Turning it on before an auth backend exists would redirect every
 * protected route to a login page that cannot issue a session — locking the
 * app permanently.
 *
 * Flip by setting `NEXT_PUBLIC_AUTH_ENABLED=true` once the backend lands.
 * Read literally so Next can inline it at build time.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
