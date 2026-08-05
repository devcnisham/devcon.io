import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig `paths` so tests import the same way the app does.
    alias: { "@": path.resolve(__dirname, "./") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
