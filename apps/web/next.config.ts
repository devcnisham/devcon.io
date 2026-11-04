import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project. Without it, Next walks up and
  // picks up a stray lockfile outside the repo.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
