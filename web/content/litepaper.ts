import type { Block } from "@/components/prose";

export const litepaperBlocks: Block[] = [
  {
    "type": "h2",
    "text": "The problem"
  },
  {
    "type": "p",
    "text": "Tokenized stocks trade 24 hours a day, seven days a week. The companies behind them do not. When the underlying market is closed — overnight, over a weekend, through a holiday — a tokenized stock can still move sharply on news while the real exchange sits idle. The price **gaps**: it jumps from one level to another with nothing traded in between."
  },
  {
    "type": "p",
    "text": "For anyone who has borrowed against that stock, a gap is dangerous. A loan secured by collateral has a line it cannot cross — the point where the collateral is no longer worth enough to safely back the debt. Cross it and the position is **liquidated**: the collateral is sold off to repay the loan, usually at a penalty. When a price gaps down at 3 a.m. on a Sunday, there is no time to react and no market to react in. People get liquidated in their sleep."
  },
  {
    "type": "p",
    "text": "This is not an edge case for tokenized equities — it is the structural risk. The 24/7 wrapper outpaces the market it represents, and the borrower carries the difference. Existing lending protocols were designed for assets that trade continuously; they assume you can always act before the line. For tokenized stocks, that assumption breaks every weekend."
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "The solution: Tessera and the Watcher"
  },
  {
    "type": "p",
    "text": "Tessera is a lending protocol where you borrow USDC (a US-dollar stablecoin) against tokenized stocks. Two sides meet: **lenders** supply USDC and earn yield from borrow interest; **borrowers** post tokenized-stock collateral and draw USDC against it."
  },
  {
    "type": "p",
    "text": "What makes Tessera different is a piece neither side has to manage themselves: an autonomous risk agent we call **the Watcher**. It watches every open position around the clock and works to head off a liquidation before it happens — the structural answer to the gap problem, built into the protocol rather than left to the borrower's reflexes."
  },
  {
    "type": "p",
    "text": "Plainly: you deposit, you borrow, and an agent watches your back continuously so an overnight move is far less likely to wipe you out. Precisely: the Watcher re-checks each borrower's safety margin about every ten seconds, sends plain-English alerts as risk builds, and — only if you opt in — repays part of your debt from USDC you have pre-approved, pulling you back from the edge before the liquidation line is crossed."
  },
  {
    "type": "callout",
    "tone": "info",
    "body": "It can watch your position and, with your opt-in, reduce your own debt using an allowance you set and can revoke at any time. It cannot custody your funds, cannot move money anywhere except down on your own loan, and cannot guarantee protection — a severe enough gap can still liquidate a position. The Watcher narrows the failure window; it does not promise it away.",
    "title": "What the Watcher can and cannot do"
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "How it works"
  },
  {
    "type": "h3",
    "text": "Lend"
  },
  {
    "type": "p",
    "text": "Supply USDC to the protocol and earn yield. Your USDC funds borrowers, who pay interest; that interest, less a protocol reserve, accrues to lenders. You can withdraw subject to available liquidity. Precisely: supplied USDC sits in the vault and earns the borrow rate set by a utilization-based interest-rate curve, capped at a hard ceiling so the rate can never run away."
  },
  {
    "type": "h3",
    "text": "Borrow"
  },
  {
    "type": "p",
    "text": "Post a tokenized stock as collateral and borrow USDC against it, up to a conservative limit set per asset. The limits are deliberately gap-aware — lower than a continuously-traded asset would get — because the collateral can move while the underlying market is shut. Precisely: each loan tracks a **health factor (HF)** — the risk-weighted value of your collateral divided by your debt, scaled so that **1.0 is the liquidation line**. Above 1.0 you are safe; at 1.0 the position becomes liquidatable."
  },
  {
    "type": "p",
    "text": "If a position does cross the line, liquidation is partial and bounded. A liquidator may close up to half the position in one step (the **close factor**) and earns a base bonus of 5% that ramps with depth. Only below a health factor of 0.95 can a position be fully closed. A minimum debt of 100 USDC keeps positions economically sensible to manage."
  },
  {
    "type": "h3",
    "text": "AI protection"
  },
  {
    "type": "p",
    "text": "The Watcher is the layer that makes the borrow side genuinely safer. In plain terms: it never sleeps, it warns you early, and — if you allow it — it acts on your behalf to keep you above the line. In precise terms, three properties make that trustworthy rather than scary:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "**Deterministic decisions, AI words.** A deterministic core decides whether and how much to repay — never a language model. The model only writes the human-readable alert. Money never moves on a probabilistic guess.",
      "**On-chain spending caps.** Auto-repay is bounded by limits enforced by the contract itself: at most 10,000 USDC per user per transaction and 25,000 USDC per user per day. These are on-chain, not promises in code the agent runs.",
      "**A silence backstop.** The Watcher stamps an on-chain heartbeat. A permissionless backstop is built and tested so that, once enabled, anyone can liquidate if the agent goes silent past the configured delay — so the protocol is never dependent on a single agent staying online. On testnet the delay is 0 (backstop off, agent-only); switching it on is an explicit mainnet gate."
    ]
  },
  {
    "type": "p",
    "text": "Control stays with you. The kill switch is simple: revoke the allowance and the Watcher can no longer touch your debt. An on-chain admin fail-safe lets the protocol halt the agent as well. The agent acts only through the vault's permissioned entrypoints — it is a participant with narrow, capped powers, not a custodian."
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "Parameters"
  },
  {
    "type": "p",
    "text": "The protocol's risk and economic parameters are public and on-chain. The collateral limits below are conservative by design: **max LTV** is the most you can borrow against an asset, and the **liquidation threshold** is where the position becomes liquidatable."
  },
  {
    "type": "table",
    "headers": [
      "Collateral",
      "Max LTV",
      "Liquidation threshold"
    ],
    "rows": [
      [
        "tAAPL (Apple)",
        "50%",
        "65%"
      ],
      [
        "tTSLA (Tesla)",
        "40%",
        "55%"
      ],
      [
        "tSPY (S&P 500 ETF)",
        "60%",
        "75%"
      ]
    ]
  },
  {
    "type": "table",
    "headers": [
      "Protocol parameter",
      "Value"
    ],
    "rows": [
      [
        "Liquidator bonus (base, ramps with depth)",
        "5%"
      ],
      [
        "Close factor (max % closed per step)",
        "50%"
      ],
      [
        "Full close below health factor",
        "0.95"
      ],
      [
        "Reserve factor (share of borrow interest)",
        "15%"
      ],
      [
        "Minimum debt per position",
        "100 USDC"
      ],
      [
        "Watcher auto-repay cap, per user / transaction",
        "10,000 USDC"
      ],
      [
        "Watcher auto-repay cap, per user / day",
        "25,000 USDC"
      ],
      [
        "Backstop opens after agent silence (testnet)",
        "15 minutes"
      ]
    ]
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "Why it is defensible"
  },
  {
    "type": "p",
    "text": "Tessera's moat is not a feature that can be copied in an afternoon; it is the **AI risk layer** and the credibility model around it."
  },
  {
    "type": "p",
    "text": "The risk layer is hard to replicate honestly. Watching positions every ten seconds, deciding deterministically when to act, repaying within on-chain caps, and falling back to a permissionless backstop when the agent goes quiet — that is an integrated system spanning a Rust vault, an oracle-policy contract, and an off-chain agent, all designed together so the agent's powers are narrow and verifiable. The defensibility is in the discipline, not the slogan: capped, revocable, deterministic, and accountable on-chain."
  },
  {
    "type": "p",
    "text": "The second source of defensibility is **no token, ever.** Tessera will never sell a coin. There is no governance token to inflate, no emissions to prop up yields, no exit liquidity for insiders. Revenue is the reserve factor on real interest — nothing else. That removes the most common reason DeFi protocols lose user trust, and it is a commitment competitors built on token economics cannot match without unwinding their own model."
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "The market"
  },
  {
    "type": "p",
    "text": "Tokenized real-world assets — equities first among them — are moving on-chain, and the 24/7 trading wrapper is becoming the norm rather than the experiment. Every tokenized stock that can be held can, in principle, be borrowed against. But the gap-risk that comes with round-the-clock trading against a part-time market makes naive lending unsafe, which is exactly why a purpose-built risk layer is needed before this market can scale responsibly."
  },
  {
    "type": "p",
    "text": "Tessera is positioned as that layer. Our near-term scope is borrowing USDC against tokenized equities; our long-term direction is to become the autonomous AI risk layer for tokenized real-world-asset lending generally — the safety infrastructure other products can rely on as the asset set widens."
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "Business model"
  },
  {
    "type": "p",
    "text": "Tessera earns from a **15% reserve factor**: of the interest borrowers pay, 15% is routed to an on-chain reserve. That reserve serves two purposes at once — it is the protocol's revenue, and it is a first-loss buffer that absorbs bad debt before lenders are touched. The remaining 85% of interest flows to lenders as yield."
  },
  {
    "type": "p",
    "text": "This is the entire model. There is **no token sale, no emissions, and no fundraising through a coin** — now or in the future. The protocol makes money only when it is genuinely used, and the same mechanism that produces revenue also makes the system safer. Incentives are aligned by construction: we earn by lending working well, not by a token going up."
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "Roadmap"
  },
  {
    "type": "p",
    "text": "We are honest about what is shipped and what is gated. The following items are not yet done; each is a **mainnet gate** — a condition that must be met before Tessera opens to real funds — not a feature we are implying is live."
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "**Live now (testnet).** The full vault, PriceGuard oracle-policy contract, read-only Lens, and the Watcher agent are deployed and running on Robinhood Chain (an Arbitrum Orbit L2). The code is open-source.",
      "**Mainnet gate — real price feed.** The on-chain price feed today is a testnet mock. A real, licensed market-data feed must be integrated before mainnet.",
      "**Mainnet gate — security audit.** An independent audit of the contracts and agent must be completed. Tessera has not been audited.",
      "**Mainnet gate — reserve and liquidity.** The first-loss reserve and lender liquidity must be sufficient to back real positions.",
      "**Mainnet gate — regional and compliance controls.** Tessera is not available to US persons or to sanctioned jurisdictions; the necessary controls must be in place before real funds."
    ]
  },
  {
    "type": "divider"
  },
  {
    "type": "h2",
    "text": "Where we are"
  },
  {
    "type": "callout",
    "tone": "warning",
    "body": "Tessera is deployed and running on Robinhood Chain (an Arbitrum Orbit L2, chain 46630), a testnet. It is not open to real money. The on-chain price feed is currently a testnet mock; a licensed feed is a mainnet gate. We have no audit, no TVL, no real users, no returns, and no insurance, and we do not claim any. Everything not yet built is named above as a mainnet gate, not implied as shipped.",
    "title": "Live on testnet — not yet open to real funds"
  },
  {
    "type": "quote",
    "text": "Tessera: the safest place to borrow against tokenized stocks."
  }
];
