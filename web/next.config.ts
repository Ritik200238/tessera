import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The web app is a leaf workspace; transpile our shared workspace
  // packages by name if/when they appear.
  transpilePackages: [],
  // This app lives in `web/` but reads `../../shared/*` (addresses + ABI). Pin the
  // workspace root to the monorepo root so Turbopack traces those files and so the
  // build doesn't guess the wrong root from a stray parent lockfile (e.g. on Vercel
  // with Root Directory = web).
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  experimental: {
    // App Router is default in Next 16; keep this block for future flags.
  },
};

export default nextConfig;
