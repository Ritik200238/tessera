# Tessera — Launch-Readiness Asset Build Plan

**Purpose.** Build the complete "product ecosystem" of assets that makes Tessera read as a serious, production-grade startup to five audiences at once: **judges, prospective users, investors, developers, and community.** This document is the locked, authoritative spec for the autonomous build. Follow it exactly. No half-baking, no placeholders (except the one explicitly-allowed team-identity gap), zero bugs, CI-green at every commit.

---

## 0. Standards every asset is held to (non-negotiable)

- **Voice:** confident, mature, technically honest. Reads like Stripe — **no hype, no emoji-spam, no memecoin energy, minimal jargon** (and any necessary term is explained on first use). Credibility through clarity, never through superlatives.
- **Audiences served simultaneously:** a non-technical user must understand it; a developer must respect it; an investor must believe it's a real company; a judge must find nothing unprofessional.
- **Consistency:** one voice, one set of facts, one visual rhythm across every page and asset. No contradictions, no drift.
- **Honesty (this is the moat):** never claim what isn't true of the running system. Testnet is stated plainly; mainnet gates are named, not hidden. This honesty is what earns sophisticated trust — preserve it.
- **Canonical tagline (use verbatim everywhere — OG, deck, litepaper, footer, X bio guidance):** **"The safest place to borrow against tokenized stocks."**
- **Single source of truth:** create `web/lib/content.ts` (a typed module) holding the canonical facts — what Tessera is, the mechanics, the numbers (LTVs, reserve factor, chain), links, the tagline, team data. Every page imports from it so nothing can drift.
- **Engineering bar:** reuse the existing component library (`web/components/ui/*`, Card/Alert/etc.) and design tokens; fully responsive; accessible (semantic headings, alt text, contrast); SEO + OG per page; `npm run typecheck && lint && test && build` green before each commit.

---

## 1. Information architecture (navigation) — the explicit constraint

**Header (keep minimal — do NOT add the new content here):** product actions only — Borrow, Earn/Lend, Dashboard, Status, Connect Wallet (as it is today). The new informational assets do **not** go in the header. *At most one* may earn a header slot — **Docs** — and only if it reads cleanly; default is to leave the header unchanged.

**Footer (the discovery hub — redesign into clear sections/columns):**
- **Product:** Borrow · Earn · Dashboard · Markets · Explore · Live Drill · Status
- **Developers:** Docs · API/Developers · GitHub · Security · Transparency
- **Company:** About · Blog · Roadmap · Why Tessera
- **Resources:** FAQ · Litepaper · Whitepaper *(when published)*
- **Legal:** Terms · Privacy · Disclaimer · Brand & License
- **Social:** X *(handle TBD)* · (Community — later)

The footer must be visually clean and scannable (columns with section labels), not a flat link dump. The landing page's own full-bleed footer (`web/app/page.tsx`) and the app shell footer (`web/components/shell.tsx`) must be reconciled to the same structure.

---

## 2. The assets (each: route · contents · done-criteria)

### 2.1 Team / About — `/about`  *(Company)*
- **Decisions:** you + co-founder(s); real names, **no photos**; **mission-led**; minimal & clean.
- **Structure:** (1) Mission hero — the problem (people liquidated by overnight gaps in 24/7 tokenized-equity markets) and what Tessera exists to fix; (2) "What we're building" — one tight paragraph; (3) Team — clean name + role cards (no photos); (4) How we work / principles — 3–4 crisp values (security-first, no token ever, radical transparency, build in public); (5) Contact — email + X.
- **Team-identity gap:** real names/roles/contact come from the founder. If not supplied in the `/goal` message, use clearly-marked `[Founder name — role]` placeholders and a visible `TODO(team)` note; build everything else fully. Never invent a real person's name.
- **Done:** renders, footer-linked under Company, OG + metadata set, mobile-clean.

### 2.2 Litepaper — `/litepaper` (web) + `/public/tessera-litepaper.pdf`
- **Decisions:** PDF **+** web; layered tone.
- **Contents (~2 pages):** Problem · Solution (Tessera + the Watcher) · How it works (lend / borrow / AI protection, plain then precise) · Why it's defensible (the AI risk layer + no-token credibility) · Market · Business model (15% reserve factor, no token) · Roadmap (honest, mainnet-gated) · Team · Links + tagline.
- **Build:** the web page is the source of truth, with a print stylesheet; generate the PDF from it via a headless-browser render script (committed to `/public`). If PDF tooling is unavailable, ship the print-optimized page + a build script + a note. Footer-linked under Resources.
- **Done:** web page polished + print-clean; PDF present and legible; no number contradicts `content.ts`.

### 2.3 Docs — `/docs` + FAQ — `/faq`  *(Developers / Resources)*
- **Decisions:** on-app pages; **layered**; **comprehensive** (How it works · The AI · Risks · Ops).
- **/docs:** a docs layout (left nav / TOC + content). Sections: Overview · How to Lend · How to Borrow · Health Factor · The Watcher (what it does / doesn't, kill switch, downtime) · Active Protection · Risks (gap, oracle, liquidation, smart-contract, off-hours) · Oracle & pricing · Liquidation & the backstop · Fees & revenue (no token) · Supported regions · Architecture (vault / PriceGuard / Lens / agent) · Security. Plain-English lead, technical depth below.
- **/faq:** 20+ Q&A grouped — "How does Tessera work?" · "What does the AI actually do?" · "What are the risks?" · "Operational / regional / fees / team." Must not promise audits, returns, or insurance we don't have.
- **Done:** sidebar/TOC nav works, anchors link, both footer-linked, consistent with docs and `content.ts`.

### 2.4 Pitch deck — `docs/pitch/` (markdown source) + `/public/tessera-deck.pdf`  *(NOT public nav — investor asset)*
- **Decisions:** all-purpose; balanced arc; credibility/intro framing; polished PDF; I deliver structured slide content + design direction (visual finalization later).
- **Slides (~12–15):** Title + tagline · Problem · Why now · Solution · How it works · The AI moat · Market & opportunity · The wedge (target user) · Product (live testnet + drill + traction signals) · Business model (reserve factor, no token) · Roadmap to mainnet (gated) · Team · Vision / ask.
- **Build:** markdown deck source + a rendered PDF (Marp/print-to-PDF) committed to `/public`; not linked in the footer (shared privately). Honest framing (testnet, pre-funding).
- **Done:** complete slide content, coherent arc, rendered PDF present, no overclaims.

### 2.5 Blog — `/blog` + posts + build-in-public scaffold  *(Company)*
- **Decisions:** on-site `/blog`; content = build-in-public + technical deep-dives + educational/market + announcements; confident/technically-honest voice; **professional, no jargon, complete.**
- **Build:** a blog index + post pages (MDX or a typed posts module), reusable post layout, tags, dates, OG per post. A documented, repeatable way to add posts (the build-in-public scaffold).
- **Seed posts (write 3–4, fully):** (1) "Introducing Tessera" — vision/announcement; (2) "How the Watcher works" — technical deep-dive (deterministic core + the AI layer, honest about limits); (3) "Why 24/7 tokenized-stock markets break people" — educational/market; (4) optional "Build log #1" — build-in-public momentum.
- **Done:** index + posts render, footer-linked, OG works, voice consistent.

### 2.6 Waitlist + Analytics  *(conversion + proof-of-pull)*
- **Waitlist:** email **+ a short use-case question** (e.g., "what would you borrow against, and why?"). Build the form UI (placed for max signups — a hero/section CTA + a `/waitlist` page) wired to the existing agent `POST /waitlist` endpoint (`agent/src/http/routes/waitlist.ts` + the SQLite store already exist). Validate input, handle success/error/duplicate states gracefully, no PII beyond email + answer (+ optional wallet). **Durability flag:** Render free tier is ephemeral; mirror each signup to the incident webhook (if set) so signups are never silently lost, and note that a durable store (a Vercel-marketplace DB) is the recommended next step.
- **Analytics:** Vercel Web Analytics (`@vercel/analytics`) in the root layout (privacy-respecting, cookieless) + custom events for the funnel: page → connect wallet → borrow/lend, waitlist signup (+ source), drill/demo engagement. These are the investor metrics.
- **Done:** form submits + persists via the agent, success/error UX clean, analytics + custom events wired, no console errors.

### 2.7 Legal — `/privacy` · `/disclaimer` · cookie consent · `/brand`  *(Legal)*
- **Decisions:** Privacy Policy + Disclaimer + Cookie/consent + License/brand-use; interim, honest, clearly-testnet tone (matching `/terms`).
- **Build:** `/privacy` (what's collected — waitlist email + analytics — how used, never sold, contact); `/disclaimer` (not financial advice, testnet, no warranty); a lightweight cookie/consent notice (analytics is cookieless, so keep it minimal + honest); `/brand` (open-source license clarity + name/mark usage). All footer-linked under Legal.
- **Done:** all four present, consistent voice, no false legal claims, "not legal advice / counsel-reviewed at mainnet" stated.

---

## 3. Cross-cutting (do these as part of the build)
- **`web/lib/content.ts`** — the canonical facts/tagline/links/team module; every page imports from it.
- **SEO** — per-page `metadata` + OG images, `sitemap.ts`, `robots.ts`.
- **Footer redesign** — the sectioned IA from §1, reconciled across `shell.tsx` and the landing footer.
- **Reuse** — existing UI components + tokens; no new design language.
- **A11y + responsive** — semantic headings, alt text, keyboard-navigable, mobile-clean.

## 4. Execution rules (for the autonomous run)
- **Order:** About → Litepaper → Docs → FAQ → Pitch deck → Blog → Waitlist+Analytics → Legal → Footer/IA + SEO → final review. (Build `content.ts` + footer IA early so everything hangs off them.)
- **Content generation:** use a workflow of expert-writer agents grounded in one shared voice + fact sheet to draft the long-form copy (litepaper, docs, FAQ, deck, posts), then assemble + build the pages and adversarially proofread for tone consistency, accuracy vs `content.ts`, and zero overclaims.
- **Per asset:** build → `typecheck && lint && test && build` green → commit with a clear message → next. Never leave the tree red or a page half-built.
- **No questions** during execution (autonomous). Make the best professional call and proceed; record any assumption in the commit message.
- **Final pass:** every footer link resolves; no broken routes; OG renders; voice is consistent; nothing contradicts the running system; all CI jobs green.

## 5. Out of scope / deferred (do NOT build now)
- **Telegram alert bot** — deferred (spec later).
- **Brand/logo + full visual identity** — the founder will do this in Claude design; use clean placeholders + **remind the founder after everything else is built.**
- **Whitepaper (full), domain, X handle, demo video** — founder-owned.
- **Durable waitlist DB, real audit, mainnet items** — flagged, not built.
