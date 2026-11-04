import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Next.js loads .env.local automatically; vitest does not. Load the same
  // files (via Vite's loader, no extra dependency) so tests see DATABASE_URL
  // and the Supabase keys — src/lib/env.ts throws at module load without
  // them. Real shell env keeps precedence (only missing keys are filled).
  const env = loadEnv(mode, path.resolve(__dirname), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    },
    resolve: {
      // `server-only` exists to make a client import a hard error. Under test
      // there is no client/server boundary, so stub it out — the guarantee is
      // enforced by the Next build (which is where it matters), not here.
      alias: {
        "@": path.resolve(__dirname, "src"),
        "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      },
    },
  };
});
