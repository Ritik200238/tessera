# Tessera — Front-End Design Brief

This document is the complete functional and informational specification for the Tessera web application. It describes **what** the front-end must do, **what** data it must show, **what** flows users must complete, **what** edge cases must be handled, and **what** technical constraints exist. It deliberately does **not** prescribe visual or interaction design — those are the front-end engineer's domain.

---

## 1. Product overview

**Tessera** is a non-custodial lending protocol where:

- **Lenders** deposit USDC into a single pool and earn yield from borrowers' interest payments.
- **Borrowers** deposit tokenized equities (e.g. tokenized TSLA, AAPL, NVDA, SPY, QQQ) as collateral and borrow USDC against them.
- An **AI agent** monitors every borrower 24/7, sends plain-English risk alerts, auto-repays debt from a user's pre-approved USDC when enabled, and executes protective liquidations when health factor breaches occur.

The product runs on **Robinhood Chain** as its primary deployment and **Arbitrum Sepolia** as its launch fallback. Smart contracts are built with Arbitrum Stylus (Rust → WASM). The agent is a TypeScript service. The front-end is the only surface end-users ever touch.

### Product positioning (the designer must internalize this)

- Tessera is **not** Robinhood, not a brokerage, not a meme protocol, not a points farm.
- Tessera is the **safest DeFi venue** for earning yield on or borrowing against tokenized equities.
- Long-term vision: "Autonomous financial infrastructure for 24/7 tokenized equity markets."

### Non-negotiable product principles

- **No token, ever.** No airdrops, no points, no governance token, no fee discount tiers. The front-end must never imply otherwise.
- **No custody.** Tessera never holds user funds. The smart contract holds funds; the agent only acts via permissioned entrypoints or user-signed approvals.
- **Geo-block US and sanctioned jurisdictions** at the frontend (Cloudflare or equivalent).
- **Radical transparency.** Every liquidation, every agent action, every parameter change must be publicly visible somewhere in the app.
- **No fake demos.** Every screen must connect to real data from the contract, the agent, or the indexer. No placeholder values rendered to users.

---

## 2. Target users (the designer designs for these humans)

### Primary — "The Aave Migrator"
- Currently supplies USDC on Aave / Spark / Morpho for 5–8% APY
- Daily user of Base, Arbitrum, occasionally Arc, Ethereum mainnet
- Fluent in DeFi vocabulary: health factor, LTV, liquidation, oracle, utilization
- Reads docs, audits contract addresses, joins Discords selectively
- Decision trigger: Tessera's USDC supply APY beats Aave's by 100–200 bps with comparable safety story → migrates a fraction of USDC

### Secondary — "The Equity Leveraged Long"
- Already holds tokenized TSLA / NVDA / SPY / QQQ tokens
- Wants leveraged exposure to those positions
- No good DeFi venue today (alternatives: Robinhood margin, perp DEXes)
- Decision trigger: usable LTV + AI safety net preventing overnight liquidation

### Explicit non-users at MVP
- Robinhood-style retail with no DeFi experience
- Institutional treasury managers (no KYC track yet)
- US-resident users (geo-blocked)

---

## 3. Core concepts the design must convey

The designer's job is to make these concepts unmistakable to a competent DeFi user without requiring them to read docs first:

| Concept | What it means | Where it appears |
|---|---|---|
| Lend USDC | Deposit USDC into the pool, earn variable APY | Lender flow, dashboard |
| Borrow USDC | Borrow USDC against pledged collateral, pay variable APR | Borrower flow, dashboard |
| Collateral | Tokenized equity pledged to back a loan | Borrower flow, position detail |
| Health Factor (HF) | `(collateral_value × liq_threshold) / debt`. 1e18-scaled internally. > 1 = safe, < 1 = liquidatable | Borrower dashboard, position, alerts |
| LTV (Loan-to-Value) | Per-asset borrowing limit, e.g. 40–50% for blue-chips | Asset list, borrow flow, risk page |
| Liquidation Threshold | Per-asset HF cutoff at which liquidation becomes possible | Asset list, borrow flow, risk page |
| Liquidation Bonus | 5% — the discount a liquidator pays on seized collateral | Risk page, FAQ |
| Close Factor | 50% — the max share of debt that can be liquidated in one tx | Risk page, FAQ |
| Reserve Factor | 15% — share of interest the protocol keeps as revenue | Transparency page, FAQ |
| Utilization | `borrows / supply` per pool | Lender dashboard, asset page |
| Supply APY | What lenders currently earn | Hero, lender flow |
| Borrow APR | What borrowers currently pay | Hero, borrower flow |
| Oracle Freshness | Time since last Chainlink price update; "stale" if > threshold | Asset page, borrower flow, status page |
| Market Hours | NYSE open/closed/pre/after; affects gap risk | Hero, asset pages, borrow flow |
| Gap Risk | Stocks gap on Monday open / news; the reason LTVs are conservative | Pre-borrow modal, risk page, FAQ |
| AI Agent | Background service that watches positions, alerts users, may auto-repay or liquidate | Borrower flow, agent panel, activity feed |
| Active Protection | Opt-in: agent pulls pre-approved USDC to auto-repay when HF crosses a threshold | Borrower flow, agent panel |
| Kill Switch | One control to disable the agent for the user's positions | Agent panel, account settings |

---

## 4. Information architecture

### Public surfaces (no wallet required)
1. **Landing** — value prop, live stats, two primary CTAs (lend / borrow), asset showcase
2. **Markets** — full list of supported assets with live rates and parameters
3. **Asset detail** `/markets/[symbol]` — per-asset overview, charts, parameters, oracle status, earnings calendar
4. **Risk** `/risk` — per-asset risk params, methodology, oracle list, agent description
5. **Transparency** `/transparency` — TVL, every liquidation ever, parameter change history, agent uptime
6. **Status** `/status` — vault paused?, per-asset paused?, oracle freshness per asset, agent heartbeat, indexer lag
7. **FAQ** `/faq` — see §14 of internal blueprint; 20+ questions across four sections
8. **Docs (external link)** — docs.tessera.xyz
9. **Whitepaper (external PDF link)**
10. **GitHub (external link)**
11. **Discord (external link)**
12. **Geo-block page** — shown when geo lookup returns US or sanctioned jurisdiction
13. **Terms of Service**
14. **Privacy Policy**

### Authenticated surfaces (wallet connected)
15. **Dashboard** `/app` — combined view of lender + borrower position; overall HF; quick actions
16. **Lend** `/app/lend` — USDC supply + withdraw
17. **Borrow** `/app/borrow` — collateral management, AI configuration, USDC borrow + repay
18. **Position detail** `/app/borrow/[symbol]` — single collateral position deep view
19. **Agent panel** `/app/agent` — protection mode, caps, kill switch, alert routing
20. **Activity** `/app/activity` — chronological feed of every event affecting the connected wallet (deposit, borrow, repay, alert sent, agent action, liquidation)
21. **Account settings** `/app/settings` — notification preferences (Telegram/Discord/email), connected wallet, disconnect

### Admin surfaces (multisig signers only, gated by on-chain address check)
22. **Admin dashboard** `/admin` — overall protocol health, recent events, governance actions queued
23. **Parameters** `/admin/params` — per-asset LTV, threshold, supply cap, borrow cap, reserve factor, rate-model params, oracle ref
24. **Pause controls** `/admin/pause` — global pause, per-asset pause
25. **Asset management** `/admin/assets` — list/delist collateral
26. **Treasury** `/admin/treasury` — protocol revenue accumulated, withdraw to multisig

### System surfaces
27. **Error page** (404, 500)
28. **Maintenance page** (when front-end intentionally down)

---

## 5. Per-screen data requirements

For each screen, the designer must surface (at minimum) the following data. Field names use the contract's canonical names where applicable.

### 5.1 Landing
- Live `supplyApy` (current USDC pool)
- Live `totalSupply` (TVL in USDC)
- Live `totalBorrows`
- `utilization` = totalBorrows / totalSupply
- Number of supported assets (e.g. "5 tokenized stocks")
- Brief AI value prop block (links to /risk for detail)
- "I want to lend" CTA → `/app/lend`
- "I want to borrow" CTA → `/app/borrow`
- Market hours indicator (NYSE: Open / Closed / Pre-market / After-hours / Holiday)
- Three feature blocks: equity-DeFi UX, AI protection, no-token credibility
- Footer: docs, FAQ, GitHub, Discord, status, ToS, privacy

### 5.2 Markets
For each listed asset, a row showing:
- Ticker symbol (e.g. TSLA)
- Full name (e.g. "Tokenized Tesla, Inc.")
- Sector (Technology / Consumer / Index / etc.)
- Issuer (Backed, Dinari, etc.)
- Current oracle price (USD)
- Oracle freshness (seconds since last update)
- LTV
- Liquidation Threshold
- Supply Cap (used / total)
- Borrow Cap (used / total)
- Current utilization (per-asset, if asset-segregated borrows exist; otherwise pool-level)
- Status badge: Active / Paused / Oracle Stale / Cap Reached
- Upcoming earnings date (if within 14 days)
- Link to asset detail

### 5.3 Asset detail `/markets/[symbol]`
- Everything from the row plus:
- Price history chart (oracle price over last 30 / 90 / 365 days)
- Liquidation history for this asset (count + chart over time)
- Total collateral pledged in this asset (units + USD value)
- Number of borrowers using this asset
- Full risk parameters block
- Oracle address (Etherscan link), heartbeat, deviation threshold
- Issuer information block with external link
- "Use as collateral" CTA → `/app/borrow` with asset preselected
- Earnings calendar widget (next 4 events)

### 5.4 Risk page
- One section per asset with full parameter table
- Methodology section: how LTVs are chosen, why conservative
- Oracle policy: Chainlink-only, staleness threshold, what happens on stale
- Liquidation mechanics: 50% close factor, 5% bonus (3.5 ppt agent / 1.5 ppt protocol)
- Agent description: what it does, what it doesn't, kill switch availability
- Mainnet gates list (audit, backstop, bug bounty, reserve) — show which are met

### 5.5 Transparency page
- All-time TVL chart
- All-time liquidations table (timestamp, borrower address truncated, collateral symbol, amount, tx link)
- All-time parameter changes table (timestamp, parameter, old value, new value, multisig tx link, rationale)
- Agent uptime (last 30 / 90 / 365 days as percentage)
- Cumulative protocol revenue
- Cumulative interest paid to lenders

### 5.6 Status page
- Vault paused? (Yes/No)
- Per-asset paused list
- Per-asset oracle freshness (last update timestamp + age)
- Agent heartbeat (last tick timestamp; "healthy" if < 30 seconds ago, "degraded" if 30s–5min, "down" if > 5min)
- Indexer lag (current block vs head)
- Last 24h incident log (publicly visible)

### 5.7 FAQ page
- 20+ questions, four sections (How does Tessera work / What does the AI do / What are the risks / Operational & regional)
- Each answer ≤ 150 words, plain English, no hype

### 5.8 Dashboard `/app`
When user has no positions:
- Empty state with explainer and CTAs to lend or borrow
When user has positions:
- Net position summary: total supplied, total borrowed, net APY
- Combined HF gauge (if borrowing)
- Per-position cards: each collateral with current value, debt against it, HF contribution
- Recent activity (last 5 events) with link to full activity
- Agent status indicator (Active / Paused / Killed)
- "Earnings since first deposit" counter (live-ticking)

### 5.9 Lend `/app/lend`
- Live supplyApy
- Live utilization
- User's USDC wallet balance
- User's current supplied amount
- User's earned interest since deposit
- Deposit input (amount, max button) → executes `deposit(amount)`
- Withdraw input (amount, max button) → executes `withdraw(amount)`
- Withdraw availability check: warn if `liquidityAvailable < requestedAmount`
- Transaction confirmation panel showing simulation result before signing
- Notification of permit2 / approval requirement

### 5.10 Borrow `/app/borrow`
Four sub-sections, each can be linked-to directly:

#### 5.10.a Collateral management
- List of user's collateral positions (symbol, units, USD value, % of total)
- Deposit collateral: select asset → enter amount → approval (if needed) + deposit tx
- Withdraw collateral: amount with HF preview (must stay ≥ 1e18 after withdraw)
- Asset selector shows only assets user holds in wallet (primary) plus full list (secondary)

#### 5.10.b AI Active Protection setup (mandatory step on first borrow)
- Toggle: protection mode (Off / Alerts-only / Alerts + Auto-repay)
- If Auto-repay: max repay per transaction (USDC), max repay per day (USDC)
- Health Factor trigger threshold (default conservative, e.g. 1.10)
- Required: pre-approve agent allowance OR sign EIP-2612 permit for USDC
- Single kill switch button (also accessible from agent panel)
- Explainer: what the agent can and cannot do; link to /risk

#### 5.10.c Borrow
- Borrow input: USDC amount, with live HF preview
- "Gap risk" pre-borrow modal showing: "If [asset] gaps -X% overnight, your HF becomes Y" — must be acknowledged on first borrow
- Borrow APR shown live
- Confirm → executes `borrow(amount)`

#### 5.10.d Repay
- Repay input: USDC amount, max = current debt
- Repay-on-behalf-of input (advanced): allow paying someone else's debt
- Confirm → executes `repay(amount)`

### 5.11 Position detail `/app/borrow/[symbol]`
- Single-collateral deep view
- HF history chart (last 30 days)
- Every agent intervention on this position (alerts, auto-repays)
- Liquidation history for this position (if any)
- Per-position actions: deposit more, withdraw, borrow more, repay

### 5.12 Agent panel `/app/agent`
- Current protection mode
- Current caps (per-tx, per-day USDC)
- Current HF trigger threshold
- Current allowance granted to agent (live read from USDC contract)
- Kill switch (large, deliberate, requires confirmation)
- Alert routing: Telegram / Discord / email — toggle each, configure
- Test alert button (sends sample alert to selected channel)
- Agent action history for connected wallet (every alert, every action)

### 5.13 Activity `/app/activity`
Chronological feed of all events for the connected wallet:
- Supply / Withdraw (USDC)
- Deposit collateral / Withdraw collateral
- Borrow / Repay
- Alert sent (with plain-English copy from the agent's LLM, via NVIDIA NIM)
- Agent auto-repay executed
- Liquidation (as borrower or as liquidator)
- Parameter change affecting user's assets
Each row: timestamp, event type, amounts, tx link, agent commentary (if applicable)
Filters: type, date range, asset

### 5.14 Account settings `/app/settings`
- Connected wallet address (with copy button)
- Network: current, with switch control
- Notification channels: Telegram username / Discord ID / email (all optional, no KYC implied)
- Per-channel toggle: HF warnings / HF danger / Agent actions / Liquidations / Protocol announcements
- Disconnect wallet
- Locale (English only at MVP; designer should architect for future locales)
- Theme (system / dark / light — designer's call on default)

### 5.15 Admin dashboard `/admin`
- Gated: only addresses in the multisig signer set see this; everyone else gets 404
- Overall TVL, utilization, revenue accumulated
- Queue of pending governance actions
- Recent liquidations, recent agent actions, recent param changes
- Quick links to params, pause, treasury

### 5.16 Admin params `/admin/params`
- Per-asset editable form: LTV, liquidation threshold, supply cap, borrow cap, reserve factor, oracle ref, rate-model params (`baseRate`, `slope1`, `slope2`, `kink`)
- Every change requires multisig submission; UI generates the multisig payload
- Show last-changed-at and last-changed-by for each parameter

### 5.17 Admin pause `/admin/pause`
- Global pause toggle
- Per-asset pause toggle list
- Each toggle requires multisig submission

### 5.18 Admin assets `/admin/assets`
- List / delist tokenized stocks
- New-listing form: symbol, address, oracle ref, initial params
- Delist confirmation flow with warnings about open positions

### 5.19 Admin treasury `/admin/treasury`
- Accumulated protocol revenue (from reserve factor + liquidation cut)
- Withdraw form: amount, destination multisig address

---

## 6. User flows (step-by-step)

### 6.1 Lender — first deposit
1. Land on `/` → click "I want to lend"
2. If wallet not connected: prompt connect
3. If wallet on wrong chain: prompt switch
4. If user in US/sanctioned country: geo-block page
5. `/app/lend` opens with current rates and user's USDC balance
6. User enters amount or hits max
7. If allowance < amount: prompt USDC approval (or use permit2 if supported)
8. User signs approval; tx pending → confirmed
9. User signs deposit; tx pending → confirmed
10. Position appears; earnings counter begins ticking
11. Inline "what's next" suggestion: configure alert channel in settings

### 6.2 Lender — subsequent deposit
- Same as 6.1 but skip the explainer; allowance may already exist

### 6.3 Lender — withdraw
1. `/app/lend` → withdraw section
2. User enters amount; UI checks `liquidityAvailable`
3. If insufficient liquidity: warn with current available amount
4. User signs withdraw tx; tx pending → confirmed
5. Position updates

### 6.4 Borrower — first borrow (the canonical 5-step flow)
1. Land on `/` → click "I want to borrow"
2. Wallet connect + chain + geo checks
3. `/app/borrow` opens
4. **Step A — Choose collateral**: select tokenized stock from list (user-held assets surfaced first)
5. **Step B — Deposit collateral**: enter amount → approval (if needed) + deposit tx
6. **Step C — Configure AI protection**: toggle mode, set caps, approve USDC allowance for agent OR sign permit
7. **Step D — Borrow**: enter USDC amount, HF preview live; gap-risk modal on first borrow; borrow tx
8. **Step E — Confirmation**: position summary, HF gauge, link to dashboard, suggestion to test alert

### 6.5 Borrower — subsequent borrow
- Skip A if already has collateral; skip C if already configured; gap-risk modal once per session

### 6.6 Borrower — repay
1. `/app/borrow` → repay section
2. Enter amount (max = current debt + small buffer for interest accrual)
3. If allowance < amount: approve USDC
4. Sign repay tx; tx pending → confirmed
5. HF updates; position updates

### 6.7 Borrower — adjust AI config
1. `/app/agent`
2. Change mode / caps / threshold → on-chain `setAgentSpendingCap` tx
3. Confirmation; agent panel reflects new state

### 6.8 Borrower — kill switch
1. Click kill switch (large, deliberate, requires explicit confirmation step)
2. On-chain tx zeros agent allowance + sets per-user kill flag
3. Confirmation; agent panel shows "Killed — no actions will be taken on your behalf"
4. Re-arming requires reconfiguration (not a single toggle)

### 6.9 Borrower — receives an alert
- Out-of-band: Telegram/Discord/email message arrives with LLM-written copy
- In-app: activity feed shows the alert with the exact same copy + a "View position" CTA
- If HF crosses configured threshold while protection is on: agent auto-repays from allowance; user sees a different feed entry "Tessera repaid X USDC on your behalf — HF restored to Y"

### 6.10 Borrower — liquidation event
1. HF drops below 1e18; agent executes partial liquidation (50% close factor)
2. User sees activity feed entry: timestamp, what was seized, what debt remains, new HF
3. Empathetic copy explaining what happened; link to /risk and FAQ for context
4. Email/Telegram/Discord alert if configured
5. Dashboard HF gauge updates

### 6.11 Admin — change a parameter (multisig)
1. Admin signer connects → `/admin/params`
2. Edits parameter; UI shows old → new diff
3. Requires written rationale (will appear on Transparency page)
4. UI generates multisig payload → admin submits to Safe (or equivalent)
5. After Nth signature + execution: change goes live, Transparency page updates

### 6.12 Visitor — US geo-block
1. Visitor lands; Cloudflare middleware checks IP
2. If US or sanctioned: serve geo-block page with explainer + link to docs
3. No wallet connection prompted; no smart-contract reads from this client

---

## 7. Wallet & network integration

### Supported wallets
- Coinbase Wallet
- Rabby
- MetaMask
- WalletConnect v2 (covers Trust, Zerion, Ledger Live, others)
- Designer should architect "connect wallet" surfaces as wallet-agnostic; ConnectKit (chosen library) handles this.

### Networks
- **Primary:** Robinhood Chain (mainnet + testnet)
- **Fallback:** Arbitrum Sepolia (the actual MVP launch network)
- Front-end must detect chain mismatch and prompt switch
- Chain ID, RPC URL, block explorer URL come from `shared/addresses/local.json` (synced at build time)
- Per-network contract addresses come from same JSON (vault, USDC, each tokenized stock, each oracle)

### Signature flows
- **USDC approve**: standard ERC-20 approval (one-time per amount or unlimited)
- **EIP-2612 permit** for USDC (where supported by the USDC contract): single signature replaces approval tx
- **Transaction sign**: standard eth_sendTransaction
- **No off-chain SIWE** at MVP (the app does not have backend sessions for the connected user)

### RPC reliability
- Two RPC URLs per chain (primary + fallback); front-end transparently fails over
- Public RPC fallback for read-only flows (e.g. landing page, markets) so visitors don't need wallet

---

## 8. Real-time / live data requirements

| Data | Source | Cadence |
|---|---|---|
| supplyApy, borrowApr, utilization | Vault contract read | every 15s + on user action |
| Oracle price per asset | Chainlink AggregatorV3 (via contract or direct) | every 15s + on asset detail open |
| Oracle freshness | Computed from oracle round timestamp | every 5s on status / asset pages |
| User HF | Vault `getHealthFactor(user)` | every 10s when on dashboard / position |
| User account data | Vault `getAccountData(user)` | every 10s when on dashboard |
| Wallet token balances | viem balance reads | on connect, on tx confirm, on focus |
| Activity feed | Indexer (subgraph or custom) | on demand + websocket subscription if available |
| Agent action log | Agent's public JSONL telemetry endpoint | every 30s on activity / agent panel |
| Agent heartbeat | Last tick timestamp from same endpoint | every 5s on status |
| Market hours | NYSE schedule (static + holiday calendar) | computed locally; updated daily |
| Earnings calendar | Polygon.io free tier or equivalent | daily fetch, cached |

### Stale data handling
- If a fetch fails or returns stale data: show last-known value with a "Last updated Xs ago" indicator
- If data has been stale > 60 seconds: show a clear warning
- Never silently render zero or "loading…" forever

---

## 9. Notifications

### In-app banners (global)
- Vault globally paused → top-of-app banner with explanation + link to status
- A user's held asset is paused → top-of-app banner referencing the asset
- Oracle stale on any held asset → top-of-app banner
- Agent down (no heartbeat in > 5 min) → top-of-app banner advising caution
- Wrong network → blocking banner with switch button
- Pending transaction → non-blocking indicator (toast or persistent)

### Out-of-band channels (configured in account settings)
- Telegram bot (preferred; cheapest)
- Discord webhook
- Email (Sendgrid free tier or similar)
- All optional; user can use any combination

### Notification types
- HF warning (HF dropped below `alertThreshold`, default 1.2)
- HF danger (HF dropped below danger threshold, default 1.1)
- Agent auto-repay executed (with amount + new HF)
- Liquidation occurred (as borrower)
- Liquidation opportunity (as third-party liquidator, V2)
- Protocol announcement (pauses, param changes affecting user)
- Earnings reminder (held collateral has earnings within 48h)

### Notification copy
- All risk-level copy is generated by an LLM (open models on NVIDIA NIM, ordered fallback chain; Anthropic Claude as cross-provider backup; deterministic template if all are unavailable). The agent reports which provider wrote each alert.
- Front-end displays whatever the agent produced; never invents copy
- All transactional copy (auto-repay executed, liquidation occurred) is templated and deterministic — not LLM-generated

---

## 10. States the designer must handle

### Empty states
- No supplied USDC
- No collateral deposited
- No debt
- No activity yet
- No alerts ever received

### Loading states
- Initial app load (before wallet connect)
- After wallet connect, before first contract reads
- Mid-transaction (pending block confirmation)
- Mid-data-refresh (subtle indication, never blocks UI)

### Error states
- RPC failure
- Contract read revert (e.g. oracle stale → contract reverts)
- Transaction failure (insufficient gas, revert, user reject)
- Indexer lag warning
- Agent unreachable
- Wallet disconnected mid-session
- Wrong network
- Unsupported wallet

### Edge-case states
- Vault globally paused
- Specific asset paused
- Per-asset cap reached (can't deposit more)
- Per-asset borrow cap reached (can't borrow against that asset)
- Insufficient pool liquidity (lender wants to withdraw more than is liquid)
- User HF < 1 but not yet liquidated (in-flight)
- Mid-liquidation (block-pending)
- Post-liquidation review (user's first visit after a liquidation)
- US/sanctioned geo
- ToS not accepted yet (first connect)

---

## 11. Brand boundaries (what the design must respect — no visual prescription)

- **Voice**: confident, technically honest, no hype. Read like Stripe, Linear, Vercel. Not like a memecoin. Not like a brokerage ad.
- **Naming**: "Tessera" — from "tessera" (mosaic tile). Each collateral can be referred to as a "tile" in the portfolio.
- **Vocabulary the product never uses**:
  - "Moon", "ape", "degen", "wagmi", "gm"
  - "Earn rewards", "stake", "points", "airdrop", "tier"
  - "Best in class", "next-gen", "revolutionary"
- **Vocabulary the product always uses**:
  - "Earn yield" not "earn rewards"
  - "Borrow USDC against your tokenized stocks" not "leverage your bags"
  - "Health factor" (no euphemisms)
  - "Liquidation" called what it is, never softened
- **Emoji**: not used in product copy. (External channels like Discord/Twitter are at the founder's discretion.)

---

## 12. Content & copy rules

### Number formatting
- USD: two decimals always (e.g. `$1,234.56`)
- USDC: two decimals (`1,234.56 USDC`)
- Token units (e.g. TSLA tokens): up to 6 decimals, trailing zeros trimmed
- Percentages: two decimals for APY/APR (`5.83%`), one decimal for utilization (`82.4%`)
- Health factor: two decimals (`1.23`), with a separate "1e18 raw" view available on advanced pages
- Large numbers: use thousand separators always; suffix `K`/`M`/`B` only in compact contexts (cards, sparklines), full numbers in tables

### Time formatting
- Relative: "just now", "12s ago", "3 min ago", "2 hours ago", "yesterday", then absolute
- Absolute: `2026-05-29 14:32 UTC` (ISO-ish; always UTC for protocol events)
- Earnings dates: `Thu, Jun 4` (user's local timezone)
- Market hours: user's local timezone with `(NYSE)` annotation

### Addresses
- Truncate as `0x1234…5678` in tables; full on hover; clickable to explorer
- Never display a checksummed address inconsistently — viem's checksum is the source

### Transaction hashes
- Truncate `0x1234…5678` with explorer link

### Locale
- English only at MVP; designer should architect strings via i18n-ready scaffolding (e.g. next-intl) so future locales add cleanly

### Error messages
- Always include: what happened, what to do next
- Never expose raw RPC errors or contract revert reasons unparsed; map to human messages
- Unknown errors: "Something went wrong. Please try again, or check [status page]." + a copyable error ID for support

---

## 13. Accessibility requirements

- WCAG 2.1 AA minimum target
- Full keyboard navigation (every action reachable without mouse)
- Visible focus rings on every interactive element
- Screen-reader labels on every icon-only control
- `prefers-reduced-motion` honored — no critical info delivered through motion only
- Color is never the sole indicator (HF zones must be label + icon + color, not color alone)
- Touch targets ≥ 44×44px on touch devices
- Form errors announced via aria-live

---

## 14. Performance constraints

- Initial route LCP target: < 2.5s on a 4G connection
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms
- JS bundle target: < 200kb gzipped for initial route (excluding wallet SDKs)
- Images: Next.js `<Image>` with appropriate sizes
- Lazy-load anything below the fold + every authenticated route
- Charts: lightweight library (e.g. Recharts, Visx, lightweight-charts) — no full Highcharts/AmCharts
- No layout shift during data refresh (reserve space for live numbers)

---

## 15. Browser & device support

- Desktop-first; responsive down to 360px width
- Latest 2 versions of: Chrome, Edge, Firefox, Safari, Brave
- Mobile Safari + Chrome on iOS 16+, Android 10+
- Wallet flows tested on at least: Coinbase Wallet, Rabby, MetaMask, MetaMask Mobile (via WalletConnect)
- No support commitment for IE, Opera Mini, very old Android stock browsers

---

## 16. Technical stack & integration points

(The designer should know what they're building against; visual choices remain theirs.)

- **Framework**: Next.js 16 App Router (Turbopack)
- **Language**: TypeScript strict
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui as primitive baseline (designer can extend / replace freely)
- **Wallet**: ConnectKit on top of wagmi v2 + viem
- **Data fetching**: TanStack Query (wagmi uses it internally); reuse for non-chain data
- **Forms**: react-hook-form + zod
- **Charts**: TBD by designer (Recharts recommended for fast start)
- **Icons**: lucide-react default; designer can swap
- **Fonts**: designer's call (Geist, Inter, IBM Plex Mono common choices)
- **Auth/session**: none — pure wallet connect; no backend session
- **Indexer**: subgraph (preferred) or custom Hono-served indexer for activity/history
- **Agent telemetry**: HTTP GET endpoints exposed by the TS agent (Hono server)
- **Contract ABIs**: imported from `shared/abis/TesseraVault.json` (canonical); typed via wagmi codegen
- **Contract addresses**: imported from `shared/addresses/{chain}.json`
- **Geo-block**: Cloudflare Workers / Next.js middleware reading `cf-ipcountry` header

### Repo layout (where front-end code lives)
- `web/` — Next.js app
- `web/app/` — routes
- `web/components/` — shared components (existing ones include `dashboard-client.tsx`, `borrow-form.tsx`, `admin-panel.tsx`, and the planned `agent-controls.tsx`)
- `web/lib/` — contract clients, formatters, utils
- `shared/abis/` — canonical contract ABIs (read-only from front-end perspective)
- `shared/addresses/` — per-network deployed addresses (read-only)

### Integration endpoints the designer must wire against
- Vault contract reads (via wagmi `useReadContract`):
  - `getHealthFactor(user)` → uint256 (1e18-scaled)
  - `getAccountData(user)` → `(collateralUsd, debtUsd, healthFactor)`
  - `debtOf(user)` → uint256
  - `balanceOf(user)` (ERC-4626 share balance) → uint256
  - `totalAssets()` → uint256
  - `totalSupply()` → uint256
  - `getSafetyScore(user)` → uint256 0–100
  - Per-asset config readers (LTV, threshold, caps, oracle)
- Vault contract writes (via wagmi `useWriteContract`):
  - `deposit(amount)`, `withdraw(amount)`, `mint(shares)`, `redeem(shares)`
  - `depositCollateral(token, amount)`, `withdrawCollateral(token, amount)`
  - `borrow(amount)`, `repay(amount)`, `repayOnBehalf(user, amount)`
  - `setAgentSpendingCap(maxPerTx, maxPerDay)` (planned, Stage B)
  - `liquidate(borrower, repayAmount, collateralToken)` (admin/agent only)
- USDC ERC-20: `approve`, `permit` (EIP-2612), `balanceOf`, `allowance`
- Tokenized stock ERC-20s: same surface
- Agent HTTP (read-only):
  - `GET /heartbeat` → last tick info
  - `GET /actions?user=<addr>` → JSON list of agent actions for a wallet
  - `GET /alerts?user=<addr>` → latest alert snapshot
- Indexer (subgraph or custom):
  - Position history, event log, liquidation log, TVL history

---

## 17. Asset directory (initial whitelist)

At launch, the protocol supports **3–5 blue-chip tokenized equities**. Final list to be confirmed with the issuer partner (Backed / Dinari / Ondo). Designer should architect the asset list as data-driven (read from `shared/addresses/{chain}.json`), not hardcoded.

Expected initial set (subject to issuer availability):

| Ticker | Name | Sector | Notes |
|---|---|---|---|
| TSLA | Tesla, Inc. | Consumer / Automotive | High volatility; conservative LTV |
| AAPL | Apple Inc. | Technology | Lower volatility; higher LTV |
| NVDA | NVIDIA Corporation | Technology | High volatility |
| SPY | SPDR S&P 500 ETF | Index | Lowest volatility; highest LTV |
| QQQ | Invesco QQQ Trust | Index | Low-to-moderate volatility |

The designer must support per-asset:
- Ticker (string)
- Full legal name (string)
- Issuer (Backed / Dinari / Ondo / etc.)
- Sector tag
- Logo (SVG/PNG asset URL)
- Brand color (optional, for accents)
- Oracle address
- ERC-20 contract address

### USDC
- Always present as the only debt asset
- Per-network USDC contract address from `shared/addresses`

---

## 18. Sector taxonomy

For the "equity-DeFi UX" differentiator, every asset is tagged with a sector. Initial taxonomy:

- Technology
- Consumer / Automotive
- Healthcare
- Financials
- Energy
- Communications
- Industrials
- Index ETF
- Sector ETF
- International

Asset list and sector view must support filtering and grouping by these tags.

---

## 19. Market hours

NYSE schedule:
- Regular: Mon–Fri 09:30–16:00 ET
- Pre-market: 04:00–09:30 ET
- After-hours: 16:00–20:00 ET
- Closed on US market holidays (NYSE calendar)

The designer must show the current state (Open / Pre / After / Closed / Holiday) prominently in the borrow flow and on asset pages. Tokenized stocks trade 24/7 on-chain but the underlying prices update only during market hours; the gap risk lives in the weekend/overnight delta.

---

## 20. Earnings calendar

- Source: Polygon.io free tier (or equivalent free provider)
- Data: per-symbol next earnings date + time (BMO / AMC)
- Designer surfaces earnings:
  - Asset detail page (next 4 events)
  - Borrow flow if user picks an asset with earnings within 7 days (warning)
  - Activity feed proactive entry 48h before user-held asset's earnings
- Refresh: daily fetch, cached

---

## 21. Geo-blocking

- Cloudflare Workers (or Next.js middleware) checks `cf-ipcountry` header on every request
- Blocked: US (and US territories: PR, GU, VI, AS, MP), plus the OFAC sanctioned list (CU, IR, KP, SY, RU, BY, full list from OFAC SDN)
- Blocked visitors get a single static page with:
  - Plain explanation: "Tessera is not available in your region."
  - Link to docs (still public)
  - Link to GitHub (still public)
  - No wallet connect surface
- No bypass available; ToS enforces

---

## 22. Terms of Service & Privacy

- ToS link in footer
- ToS acceptance required on first wallet connect (one-time, stored in localStorage with a versioned key)
- Privacy policy reflects: we collect no PII; we use privacy-respecting analytics (Plausible/Umami self-hosted) with no fingerprinting; wallet addresses are public on-chain anyway; notification channel handles (Telegram username, etc.) are stored in browser localStorage only, never on a Tessera server

---

## 23. Analytics

- Plausible or Umami, self-hosted
- Events to track (no PII, no wallet addresses):
  - Page view (path)
  - "Connect wallet" clicked
  - "Connect wallet" succeeded
  - Lend flow: started, deposit signed, deposit confirmed, abandoned-at-step
  - Borrow flow: started, each step completed, abandoned-at-step
  - AI configuration: protection mode chosen, kill switch used
  - Alert opened (from email/Telegram → landed on activity page)
  - Geo-block page shown (counted, no IP stored)
- No cookies, no fingerprinting, no consent banner required (per GDPR/ePrivacy analysis for cookieless analytics)

---

## 24. Open product decisions the designer needs answers to before final delivery

The founder will resolve these; the designer should architect flexibly until resolved:

1. Domain name (`tessera.xyz` vs alternatives) — affects email-from address, social handles
2. Social handles (`@tessera_xyz` or similar) — for footer links, share metadata
3. Designer's own engagement model (full-time / contract / equity) — out of scope here
4. Notification vendor: Sendgrid vs SES (email), Telegram bot vs Discord webhook ordering
5. Tokenized-stock issuer partner: drives the actual launch asset list
6. Multisig signer set: affects admin-page address-allowlist
7. Earnings data vendor: Polygon.io free tier vs alternative

---

## 25. Out of scope at MVP (do not design these)

- Mobile native app
- KYC flow / institutional whitelist
- Token / points / staking / governance UI
- Cross-chain bridging UX (rely on external bridges)
- NL strategy synthesis ("If TSLA drops 5%, do X")
- Predictive risk dashboard
- Privacy/shielded positions
- Permissionless backstop liquidator UI (pre-mainnet item)
- Corporate actions (splits, dividends) automation surface
- Per-user tax / accounting export
- Multi-language UI (English only)
- Marketing site CMS (route everything from Next.js for MVP)

---

## 26. Quality bar (the only criterion that matters)

> Tessera must NEVER feel like AI-generated slop from any angle. Every screen, every interaction, every empty state, every error message must feel human-made, professionally engineered, thoughtfully designed, production-grade, and polished.

Specifically the front-end must satisfy:
- No placeholder copy or lorem ipsum at any point
- No dead links, no "coming soon" labels in user flows
- No broken states left unhandled
- No data shown that isn't sourced from a real contract / agent / indexer endpoint
- No claim made in copy that the product doesn't actually deliver (no fake yield, no fake guarantees, no audit claims pre-audit)
- Every screen testable end-to-end by a real user with a real wallet on testnet

---

## 27. Deliverables expected from the designer

(For coordination — these aren't visual prescriptions, just the shipping contract.)

1. Implemented components in `web/components/` and routes in `web/app/`
2. Component variants documented in Storybook (or equivalent) including all states from §10
3. Empty / loading / error / success states for every interactive surface
4. Responsive coverage from 360px to 1920px+
5. Accessibility audit passing WCAG AA (axe-core or equivalent)
6. Performance budget met (§14)
7. All copy reviewed against §11 vocabulary rules
8. All numbers formatted per §12
9. All on-chain calls wired against the canonical ABI in `shared/abis/TesseraVault.json`
10. All addresses sourced from `shared/addresses/{chain}.json`
11. Geo-block enforced before any wallet surface renders
12. ToS acceptance gate before first wallet connect

---

## 28. Where to read more

- `PRD/PRD.md` — product requirements (functional spec depth)
- `TDD/TDD.md` — technical design (contract surface, agent surface)
- `CLAUDE.md` — engineering principles (non-negotiable)
- `C:\Users\ritik\.claude\plans\soft-floating-charm.md` — the full strategic blueprint this brief was derived from
- `shared/abis/TesseraVault.json` — canonical contract ABI
- `shared/addresses/local.json` — deployed addresses
- `agent/src/` — TS agent code (for understanding what telemetry the front-end can read)
- `contracts/crates/vault/src/` — contract code (for understanding what reads/writes exist)

---

This brief is the single source of truth for what the front-end must do. If something is ambiguous, ask the founder before designing around the ambiguity. If something is missing, raise it — incompleteness here means incompleteness in the product.
