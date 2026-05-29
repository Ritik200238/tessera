import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The web app is a leaf workspace; transpile our shared workspace
  // packages by name if/when they appear.
  transpilePackages: [],
  experimental: {
    // App Router is default in Next 16; keep this block for future flags.
  },
};

export default nextConfig;
