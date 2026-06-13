export interface Slide { n: number; title: string; subtitle?: string; bullets: string[]; note?: string; }

export const slides: Slide[] = [
  {
    "n": 1,
    "title": "Tessera",
    "subtitle": "The safest place to borrow against tokenized stocks.",
    "bullets": [
      "Borrow USDC against tokenized stocks (tAAPL, tTSLA, tSPY).",
      "An autonomous AI agent, the Watcher, guards every position around the clock.",
      "Live on testnet today (Robinhood Chain). Pre-funding. Not yet open to real funds.",
      "Open-source. No token, ever."
    ],
    "note": "Open plainly: this is a credibility deck for a working testnet system, not a funding ask."
  },
  {
    "n": 2,
    "title": "The problem",
    "subtitle": "Tokenized stocks trade 24/7. The market behind them doesn't.",
    "bullets": [
      "Tokenized equities trade nights and weekends, but the underlying stock market is closed.",
      "Price gaps build up while no one can react, and positions cross the liquidation line overnight.",
      "Borrowers get liquidated in their sleep, taking a forced loss plus a liquidation penalty.",
      "Today's lending protocols were built for always-on crypto, not for assets that go dark on a schedule."
    ],
    "note": "The core insight: the danger is structural and time-based, not a one-off bad market."
  },
  {
    "n": 3,
    "title": "Why now",
    "subtitle": "Tokenized real-world assets are arriving, and the rails finally exist.",
    "bullets": [
      "Tokenized stocks are moving from concept to live products on real venues.",
      "Arbitrum Stylus lets us write the vault in Rust, with a larger code-size limit for safety hardening.",
      "Cheap, fast L2 settlement makes second-by-second monitoring and small protective repayments practical.",
      "The 24/7 gap risk is new and unsolved, so the safety layer is open to define now, not later."
    ],
    "note": "Why this is a now problem: the assets are live, the tooling is ready, the risk is unaddressed."
  },
  {
    "n": 4,
    "title": "The solution",
    "subtitle": "A lending protocol with a built-in AI risk layer.",
    "bullets": [
      "Lenders supply USDC and earn yield from borrower interest.",
      "Borrowers post tokenized-stock collateral and borrow USDC against it.",
      "Conservative, gap-aware limits: tAAPL 50% LTV, tTSLA 40%, tSPY 60%, with headroom before liquidation.",
      "The Watcher monitors every position and, with your opt-in, acts to head off a liquidation before it happens."
    ],
    "note": "Frame Tessera as ordinary lending plus a defense layer no incumbent ships."
  },
  {
    "n": 5,
    "title": "How it works",
    "subtitle": "Deposit, borrow, and let the Watcher hold the line.",
    "bullets": [
      "Health factor (HF) = risk-weighted collateral value divided by debt; 1.0 is the liquidation line.",
      "The Watcher re-checks every borrower's HF about every 10 seconds and sends plain-English alerts early.",
      "If you opt in, it auto-repays from USDC you pre-approved, bounded on-chain to 10,000 per tx and 25,000 per user per day.",
      "It stamps an on-chain heartbeat; if it goes silent past 15 minutes (testnet), a permissionless backstop opens."
    ],
    "note": "Walk the loop: monitor, alert, optionally repay, with caps and a backstop if the agent fails."
  },
  {
    "n": 6,
    "title": "The AI moat",
    "subtitle": "Autonomous protection that is safe by construction.",
    "bullets": [
      "A deterministic core makes every money decision; the language model only writes the human-readable copy.",
      "The agent never custodies funds; it can only reduce your own debt via an allowance you set and can revoke.",
      "On-chain per-user caps and a heartbeat backstop bound what it can do, even if it misbehaves or goes down.",
      "We are honest about the limit: a severe enough overnight gap can still liquidate a position."
    ],
    "note": "The moat is trustworthy autonomy: bounded, revocable, deterministic, not an LLM moving money."
  },
  {
    "n": 7,
    "title": "Market and opportunity",
    "subtitle": "Lending is DeFi's largest category; tokenized RWAs are its next leg.",
    "bullets": [
      "Overcollateralized lending is proven product-market fit on-chain across billions in activity.",
      "Tokenized stocks extend that demand to a far larger pool of equity holders and traders.",
      "Every tokenized-equity venue inherits the same 24/7 gap problem, so the risk layer is broadly needed.",
      "Long-term: Tessera becomes the autonomous AI risk layer for tokenized real-world-asset lending."
    ],
    "note": "Keep this directional and honest: we cite category logic, not invented TVL or user numbers."
  },
  {
    "n": 8,
    "title": "The wedge",
    "subtitle": "The borrower who cannot safely get this anywhere else.",
    "bullets": [
      "Target user: a tokenized-stock holder who wants liquidity without selling the position.",
      "On existing protocols they carry full overnight gap risk with no one watching the position.",
      "Tessera gives them conservative limits plus an agent that actively defends the loan off-hours.",
      "We win the safety-first borrower first, then broaden as more tokenized assets list."
    ],
    "note": "Sharpen the beachhead: the off-hours tokenized-equity borrower is underserved and reachable."
  },
  {
    "n": 9,
    "title": "Product: what is real today",
    "subtitle": "A live testnet system you can use and stress-test.",
    "bullets": [
      "Live on Robinhood Chain (Arbitrum Orbit L2, chain 46630): a Stylus vault, PriceGuard oracle policy, a read-only Lens, and the agent.",
      "Lend, borrow, and full liquidation mechanics work end-to-end through the app.",
      "A public drill lets you watch the Watcher detect risk and auto-repay a position in real time.",
      "Honest caveat: the on-chain price feed is a testnet mock today; a licensed feed is a mainnet gate."
    ],
    "note": "Show, don't tell: the drill is the proof the autonomy actually fires."
  },
  {
    "n": 10,
    "title": "Business model",
    "subtitle": "Revenue from a transparent reserve factor, never a token.",
    "bullets": [
      "We take a 15% reserve factor on borrower interest; the rest goes to lenders.",
      "That reserve doubles as the protocol's first-loss buffer, aligning revenue with safety.",
      "No token, ever. We will never fund the protocol by selling a coin.",
      "Liquidator bonus 5% base, close factor 50%, minimum debt 100 USDC: simple, conservative parameters."
    ],
    "note": "The model is boring on purpose: fee on interest, no token, incentives pointed at solvency."
  },
  {
    "n": 11,
    "title": "Roadmap to mainnet",
    "subtitle": "Honest gates between today and real funds.",
    "bullets": [
      "Done: live testnet vault, oracle policy, Lens, and a functioning Watcher with on-chain caps and backstop.",
      "Mainnet gate: replace the testnet mock price feed with a real licensed market data feed.",
      "Mainnet gate: independent security audit and external review before any real funds are accepted.",
      "Then: broaden collateral, harden the agent, and expand the reserve as positions scale."
    ],
    "note": "Name every gate explicitly; nothing unshipped is implied as done."
  },
  {
    "n": 12,
    "title": "Team",
    "subtitle": "Founder-led, building in the open.",
    "bullets": [
      "Founder-led team shipping a working testnet system before raising.",
      "Engineering bar: security-first, deterministic risk core, conservative parameters, open-source.",
      "Built in public: public repository, public risk parameters, and honest disclosures.",
      "We would rather lose a user to clarity than to a surprise."
    ],
    "note": "Detailed bios on request; the proof is the live system and the build log, not a slide of titles."
  },
  {
    "n": 13,
    "title": "Vision",
    "subtitle": "Autonomous financial infrastructure for 24/7 tokenized markets.",
    "bullets": [
      "Tokenized real-world assets will trade continuously; the safety layer cannot be a person at a desk.",
      "Tessera is building the autonomous AI risk layer that defends positions when markets gap.",
      "We are live on testnet, pre-funding, and deliberately disciplined about what crosses to mainnet.",
      "If this thesis resonates, let's talk."
    ],
    "note": "Close on vision and an open conversation, no specific dollar ask."
  }
];
