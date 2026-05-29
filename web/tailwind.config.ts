import type { Config } from "tailwindcss";

// Tailwind v4 reads most theme tokens from `app/globals.css` via @theme.
// This file is kept for editor tooling + intellisense compatibility.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
