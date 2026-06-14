import type { MetadataRoute } from "next";
import { posts } from "@/content/blog";
import { flatSections } from "@/lib/docs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Public, indexable routes. Excludes /admin, /deck (noindex investor asset),
// and /api/*.
const ROUTES = [
  "",
  "/about",
  "/borrow",
  "/lend",
  "/dashboard",
  "/risk",
  "/explore",
  "/sandbox",
  "/drill",
  "/status",
  "/agent",
  "/docs",
  "/faq",
  "/litepaper",
  "/blog",
  "/why",
  "/roadmap",
  "/security",
  "/transparency",
  "/developers",
  "/start",
  "/waitlist",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/brand",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base: MetadataRoute.Sitemap = ROUTES.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: now,
    changeFrequency: r === "" || r === "/blog" ? "weekly" : "monthly",
  }));
  const blog: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(`${p.date}T00:00:00Z`),
    changeFrequency: "yearly",
  }));
  const docs: MetadataRoute.Sitemap = flatSections.map((s) => ({
    url: `${SITE_URL}/docs/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
  }));
  return [...base, ...blog, ...docs];
}
