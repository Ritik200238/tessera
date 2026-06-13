/**
 * Canonical content + facts for Tessera — the SINGLE SOURCE OF TRUTH for copy,
 * numbers, and links used across the About page, litepaper, docs, FAQ, blog,
 * deck, and metadata. Every informational surface imports from here so nothing
 * drifts or contradicts the running system.
 *
 * Voice rule for all derived copy: confident, mature, technically honest,
 * jargon-free, no hype. Testnet is always stated plainly; mainnet items are
 * named as gates, never implied as done.
 *
 * Contract ADDRESSES live in lib/addresses.ts (chain-env aware) — do not
 * duplicate them here; this module holds narrative facts + parameters.
 */

export const brand = {
  name: "Tessera",
  /** Canonical tagline — use verbatim in OG, deck, litepaper, footer, X bio. */
  tagline: "The safest place to borrow against tokenized stocks.",
  /** One-sentence description for meta + intros. */
  oneLiner:
    "Tessera lets you borrow USDC against tokenized stocks, with an autonomous AI agent watching every position around the clock to head off liquidations before they happen.",
  /** The problem we exist to solve, in one breath. */
  mission:
    "Tokenized stocks trade 24/7, but the market behind them doesn't — so positions gap overnight and over weekends, and people get liquidated in their sleep. Tessera exists to make borrowing against tokenized equities genuinely safer, with an AI risk layer that watches and protects every position continuously.",
  /** Long-term vision. */
  vision:
    "The autonomous AI risk layer for tokenized real-world-asset lending.",
  /** Current stage — stated honestly everywhere. */
  stage: "Live on testnet (Robinhood Chain). Not yet open to real funds.",
} as const;

export const chain = {
  name: "Robinhood Chain",
  kind: "Arbitrum Orbit L2",
  chainId: 46630,
  isTestnet: true,
  /** Why this chain: its larger code-size limit holds the full safety-hardened
   *  vault that exceeds a standard L2's 24KB cap. */
  note: "An Arbitrum Orbit L2 whose larger contract-size limit holds Tessera's full safety-hardened vault.",
} as const;

/** Protocol parameters — the real on-chain values, for docs/litepaper/FAQ. */
export const params = {
  reserveFactorPct: 15, // share of borrow interest routed to the reserve (revenue + first-loss)
  closeFactorPct: 50, // max % of a position liquidatable in one step (full-close below HF 0.95)
  liqBonusPct: 5, // base liquidator bonus (ramps with depth)
  minDebtUsd: 100, // dust floor
  maxBorrowRatePct: 300, // hard ceiling on the interest-rate curve
  backstopDelayMin: 15, // agent silent this long → permissionless backstop opens (testnet)
  agentRepayCapPerDayUsd: 25_000, // on-chain cap on AI auto-repay, per user per day
  agentRepayCapPerTxUsd: 10_000, // on-chain cap on AI auto-repay, per user per tx
  noToken: true,
} as const;

export interface Collateral {
  symbol: string;
  name: string;
  maxLtvPct: number;
  liqThresholdPct: number;
}

/** Listed collateral + their conservative, gap-aware risk parameters (on-chain). */
export const collateral: Collateral[] = [
  { symbol: "tAAPL", name: "Apple", maxLtvPct: 50, liqThresholdPct: 65 },
  { symbol: "tTSLA", name: "Tesla", maxLtvPct: 40, liqThresholdPct: 55 },
  { symbol: "tSPY", name: "S&P 500 ETF", maxLtvPct: 60, liqThresholdPct: 75 },
];

/**
 * The Watcher — Tessera's autonomous risk agent. Stated precisely: what it does,
 * and (just as important for trust) what it does NOT do.
 */
export const watcher = {
  does: [
    "Watches every borrower's health factor around the clock (re-checking about every 10 seconds).",
    "Sends plain-English alerts before a position becomes dangerous.",
    "With your opt-in, auto-repays from USDC you pre-approve to head off a liquidation before it happens.",
    "Acts only through the vault's permissioned entrypoints, bounded by on-chain per-user caps.",
  ],
  doesNot: [
    "Never custodies your funds — it can only reduce your own debt, using an allowance you set and can revoke.",
    "Never decides with an LLM whether to move money — a deterministic core makes every financial decision; the language model only writes the human-readable copy.",
    "Cannot guarantee protection — a severe enough overnight gap can still liquidate a position.",
  ],
  killSwitch:
    "A single kill switch (revoke the allowance) and an on-chain admin fail-safe mean you, and the protocol, can stop the agent instantly.",
} as const;

export const links = {
  github: "https://github.com/Ritik200238/tessera",
  /** X handle — set when live. */
  x: "https://x.com/", // TODO(founder): set the real handle
  explorer: "https://explorer.testnet.chain.robinhood.com",
  /** Contact for the About page + footer. */
  contactEmail: "hello@tessera.xyz", // TODO(founder): set the real address once the domain is live
  security: "/security",
  docs: "/docs",
  faq: "/faq",
  litepaper: "/litepaper",
  blog: "/blog",
  about: "/about",
} as const;

export interface TeamMember {
  name: string;
  role: string;
  /** Optional one-line bio. */
  bio?: string;
  /** Optional links (x / github / linkedin). */
  links?: { label: string; href: string }[];
}

/**
 * TEAM — founder-only content. Real names, no photos (per the spec).
 * Leave empty to render the graceful "founder-led, bios coming soon" section;
 * fill entries to render clean name + role cards. Example shape:
 *
 *   { name: "Jane Doe", role: "Co-founder & CEO", bio: "...", links: [{ label: "X", href: "https://x.com/..." }] }
 *
 * TODO(founder): add you + your co-founder here (name + role; bio optional).
 */
export const team: TeamMember[] = [];

/** Values shown on the About page (minimal, credibility-through-substance). */
export const values = [
  {
    title: "Security before features",
    body: "Conservative loan-to-value limits, an on-chain reserve, and a deterministic risk core. We ship safety first and add surface area second.",
  },
  {
    title: "No token, ever",
    body: "Tessera will never launch a token. Revenue comes from a transparent reserve factor on interest — never from selling a coin.",
  },
  {
    title: "Radical transparency",
    body: "Open-source code, public risk parameters, honest disclosures, and a live status page. We'd rather lose a user to clarity than to a surprise.",
  },
  {
    title: "Built in the open",
    body: "Public repository, public roadmap, and a build log. Judge us by what we ship, not by what we promise.",
  },
];
