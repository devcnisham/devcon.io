import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  esbuild: { jsx: "automatic" },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) },
  },
  server: { host: "127.0.0.1", port: 4197, strictPort: true },
});
