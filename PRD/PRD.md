# Tessera — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-22  
**Status:** Draft — Arbitrum Open House London submission

---

## 1. Executive Summary

Tessera is the first yield and lending protocol purpose-built for tokenized stocks on Robinhood Chain. Users deposit tokenized equities (AAPL, TSLA, SPY, etc.) into a Stylus-powered vault and earn passive yield through peer-to-peer securities lending — the same mechanism that generates billions annually for prime brokers in traditional finance. An AI agent built on Arbitrum Vibekit monitors positions 24/7, rebalances collateral ratios autonomously, and reacts to market-moving events during weekends and off-hours when traditional finance is closed.

**The macro thesis:** DTCC — which processes $114 trillion in annual securities transactions — is launching tokenized asset settlement in July 2026, with Robinhood as its retail gateway. Tessera is the DeFi yield infrastructure those assets need when they arrive.

---

## 2. Problem Statement

### 2.1 The Core Problem

Tokenized stocks on Robinhood Chain sit idle. They earn zero yield. In traditional finance, the equivalent instrument — a stock held at a prime broker — generates 5–15% annually through securities lending (lending shares to short-sellers in exchange for a fee). That yield is captured by Goldman Sachs, Morgan Stanley, and their institutional clients. Retail holders see none of it.

### 2.2 Why Now

- Robinhood Chain testnet launched February 2026 with 4 million transactions in week one
- DTCC + 50+ firms (BlackRock, Goldman, JPMorgan) are bringing $114T in securities onchain by Q4 2026
- Zero DeFi lending or yield protocols exist on Robinhood Chain today
- Kamino Finance on Solana launched tokenized stock lending and hit $45M TVL within days of launch — with an accredited-investor-only user base. Robinhood targets 23M retail users.

### 2.3 The 24/7 Gap

Traditional markets operate 32.5 hours per week (Mon–Fri, 9:30am–4pm ET). Tokenized stocks on Robinhood Chain trade 168 hours per week. During the 81% of time that traditional markets are closed, portfolio managers cannot act on news. Tessera's AI agent can — closing positions, adjusting collateral ratios, and protecting lenders within seconds of a midnight earnings release or a weekend geopolitical event.

---

## 3. Solution Overview

Tessera has two layers:

**Layer 1 — The Vault (Smart Contract, Stylus/Rust)**  
An ERC-4626 vault on Robinhood Chain that accepts tokenized stock tokens. Deposited assets are deployed into a lending pool where borrowers can take USDC loans against stock collateral. The interest rate model (implemented in Rust via Stylus) is gas-efficient enough to run frequent rebalancing that would be prohibitively expensive in EVM bytecode.

**Layer 2 — The Agent (AI, Vibekit)**  
A Vibekit-based autonomous AI agent that monitors vault health around the clock. The agent executes liquidations when collateral ratios fall below threshold, rebalances yield allocations across strategies, and alerts users to position risk — all without manual intervention.

---

## 4. Target Users

### Primary: European Retail Stock Holder
- Holds tokenized US stocks via Robinhood Chain
- Wants passive yield without selling their position
- Analogy: The Robinhood user who already uses the Cash Sweep feature — they want their assets to "work"
- Acquisition channel: Robinhood Chain ecosystem, Open House London community

### Secondary: DeFi Yield Seeker
- Already uses Aave, Compound, Kamino on other chains
- Wants exposure to tokenized equity yield as a new asset class
- Understands collateral and liquidation mechanics
- Acquisition channel: Arbitrum DeFi communities, Vibekit ecosystem

### Tertiary: Protocol / Treasury Manager
- DAO or protocol holding tokenized stocks in treasury
- Wants yield on idle assets without custody risk
- Acquisition channel: Arbitrum DAO forums, ecosystem grants

---

## 5. Feature Requirements

### 5.1 MVP (Hackathon — 3 Weeks)

| ID | Feature | Priority | Notes |
|----|---------|----------|-------|
| F1 | Deposit tokenized stocks into vault | P0 | ERC-4626 compliant |
| F2 | Borrow USDC against stock collateral | P0 | 70% LTV ratio |
| F3 | Earn yield by lending USDC to borrowers | P0 | Dynamic interest rate |
| F4 | Withdraw deposited tokens + accrued yield | P0 | Instant for unlocked positions |
| F5 | Vibekit agent monitors collateral health 24/7 | P0 | Alerts on undercollateralization |
| F6 | Automated liquidation when LTV > 85% | P0 | Agent executes, not manual |
| F7 | Dashboard: portfolio view, yield earned, health factor | P0 | Web UI |
| F8 | Mock Chainlink price oracle for testnet stock prices | P0 | Real Chainlink at mainnet |
| F9 | Weekend rebalancing demo scenario | P1 | Key demo differentiator |
| F10 | Multi-asset support (AAPL, TSLA, SPY testnet tokens) | P1 | Single asset acceptable for MVP |

### 5.2 V2 (Post-Hackathon, Month 1–3)

| Feature | Description |
|---------|-------------|
| Covered Call Vault | Vault writes weekly covered calls on deposited stocks; users earn option premium (1–3%/week) on top of lending yield |
| Cross-chain collateral | Bridge tokenized stocks via LayerZero to Arbitrum One; use as collateral in Aave/Radiant |
| Strategy Marketplace | Third-party yield strategies can integrate; agent routes to highest-yield option |
| Live Chainlink Oracle | Replace mock oracle with real Chainlink price feeds at Robinhood Chain mainnet |
| Mobile notifications | Agent sends push alerts when user's health factor drops below threshold |

### 5.3 V3 (Vision, Month 4–12)

- Dividend streaming: tokenized stock dividends automatically reinvested or paid to USDC lenders
- Perpetuals integration: GMX/Camelot cross-collateralization with tokenized stocks
- Institutional API: programmatic vault access for treasury managers and DAOs
- DTCC flow integration: when DTCC begins settlement via Robinhood Chain (October 2026), position Tessera as the default yield layer

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│              (React + Wagmi + Robinhood Chain RPC)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Robinhood Chain Testnet                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            EquityVault.sol (Stylus/Rust)             │   │
│  │                                                     │   │
│  │  • ERC-4626 vault interface                        │   │
│  │  • Lending pool: borrow/repay/liquidate            │   │
│  │  • Interest rate model (utilization curve)         │   │
│  │  • Collateral health calculation                   │   │
│  │  • Oracle integration (Chainlink mock)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Tokenized Stock Tokens (ERC-20)              │   │
│  │         tAAPL · tTSLA · tSPY (testnet)              │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ reads/writes
┌──────────────────────────▼──────────────────────────────────┐
│                    Vibekit AI Agent                          │
│                   (EmberAGI / Arbitrum)                      │
│                                                             │
│  • Polls vault health factor every N blocks                │
│  • Triggers liquidation when LTV > 85%                     │
│  • Rebalances yield strategy allocation                    │
│  • Reacts to oracle price updates (24/7)                  │
│  • Natural language strategy config                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Smart Contract Specification

### 7.1 EquityVault (Stylus/Rust, Robinhood Chain)

**Core state:**
```rust
struct LendingPool {
    total_deposits: u128,       // total USDC deposited by lenders
    total_borrows: u128,        // total USDC borrowed
    collateral: HashMap<Address, CollateralPosition>,
    interest_index: u128,       // accrued interest multiplier
}

struct CollateralPosition {
    token: Address,             // tokenized stock address
    amount: u128,               // quantity deposited
    borrow_amount: u128,        // USDC borrowed against it
    last_update: u64,           // block timestamp
}
```

**Key functions:**
- `deposit_collateral(token, amount)` — deposit tokenized stock, receive vault shares
- `borrow(usdc_amount)` — borrow USDC up to 70% LTV of collateral value
- `repay(usdc_amount)` — repay USDC loan + accrued interest
- `liquidate(borrower)` — callable when health factor < 1.0; agent calls this
- `get_health_factor(user)` — returns collateral_value * LTV / borrow_amount
- `lend(usdc_amount)` — USDC lenders deposit; earn interest from borrowers
- `withdraw_lending(shares)` — lenders withdraw USDC + yield

**Interest rate model (utilization curve):**
```
utilization = total_borrows / total_deposits

if utilization < 80%:
    borrow_rate = base_rate + (utilization / optimal_utilization) * slope1
else:
    borrow_rate = base_rate + slope1 + ((utilization - optimal) / (1 - optimal)) * slope2
```
This is the same model Aave uses — Stylus makes it 10–100x cheaper to compute than in Solidity.

### 7.2 MockOracle (Solidity, testnet only)

- Owner-updatable price feed for tAAPL, tTSLA, tSPY
- Mimics Chainlink AggregatorV3Interface
- Replaced with real Chainlink oracle at mainnet

### 7.3 Key Parameters (MVP)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max LTV | 70% | Conservative for volatile equities |
| Liquidation threshold | 85% | Standard Aave-style buffer |
| Liquidation bonus | 5% | Incentivizes liquidators (agent) |
| Base borrow rate | 2% APY | Competitive with TradFi margin |
| Optimal utilization | 80% | Balances yield and liquidity |

---

## 8. AI Agent Specification (Vibekit)

### 8.1 Agent Responsibilities

| Task | Trigger | Action |
|------|---------|--------|
| Health monitor | Every 10 blocks | Check all positions; flag if health < 1.1 |
| Liquidation | Health factor < 1.0 | Call `liquidate(borrower)` on vault |
| Weekend watch | Continuous | Monitor oracle price updates off-hours |
| Yield optimizer | Daily | Compare strategy returns; rebalance allocations |
| Alert | Health < 1.2 | Notify user via UI (future: push notification) |

### 8.2 Agent Strategy (Natural Language Config)

```
Agent instruction:
"Monitor the EquityVault on Robinhood Chain testnet. 
 If any user's health factor drops below 1.05, send an alert.
 If any user's health factor drops below 1.0, call liquidate() immediately.
 Every 24 hours, check if total yield can be improved by adjusting 
 the lending/idle ratio.
 Prioritize safety over yield — never leave a position undercollateralized."
```

### 8.3 Demo Scenario (The Weekend Differentiator)

Script for live demo:
1. User deposits 10 tAAPL worth $2,000, borrows $1,200 USDC (60% LTV, healthy)
2. Demo operator updates mock oracle: AAPL drops 20% overnight Saturday (now worth $1,600)
3. Health factor: $1,600 × 85% / $1,200 = 1.13 → approaching threshold
4. Agent detects within seconds, sends alert to UI
5. Demo operator drops further: AAPL now $1,400 → health factor 0.99 → agent auto-liquidates
6. Contrast: "In TradFi, this position would sit at risk all weekend. No one can act until Monday 9:30am."

---

## 9. Frontend Requirements

### 9.1 Pages

**Dashboard (/):**
- Total deposited value (USD)
- Current yield rate (APY)
- Health factor gauge (green/yellow/red)
- Active borrows and collateral breakdown
- Agent status indicator (Active / Monitoring / Action taken)

**Deposit (/deposit):**
- Token selector: tAAPL / tTSLA / tSPY
- Amount input with USD equivalent
- Expected APY preview
- One-click deposit + approve flow

**Borrow (/borrow):**
- Collateral value display
- Borrow amount slider (0–70% LTV)
- Health factor preview before confirming
- Confirm borrow → receive USDC

**Lend (/lend):**
- Deposit USDC to earn lending yield
- Current lending APY
- Utilization rate display

**Agent (/agent):**
- Agent activity log (last 50 actions)
- Strategy config (natural language input)
- Manual override: pause / resume agent

### 9.2 Tech Stack

- **Framework:** Next.js (App Router)
- **Wallet:** Wagmi v2 + ConnectKit
- **Chain config:** Robinhood Chain testnet RPC
- **Styling:** Tailwind CSS + shadcn/ui
- **Data:** Direct RPC calls to vault contract (no subgraph needed for MVP)

---

## 10. Success Metrics

### Hackathon Demo Metrics
- Working deposit → borrow → yield flow on Robinhood Chain testnet
- Agent successfully detects and liquidates an undercollateralized position in live demo
- Weekend scenario demo executes cleanly end-to-end

### Post-Launch Metrics (3 months after mainnet)

| Metric | Target |
|--------|--------|
| Total Value Locked | $500K |
| Unique depositors | 500 |
| Loans originated | 200 |
| Liquidations successfully handled by agent | 100% (zero bad debt) |
| Average lending APY | 5–12% |
| Agent uptime | >99.5% |

---

## 11. Build Timeline

### Week 1 — Smart Contracts
- [ ] Set up Stylus Rust project with `cargo-stylus`
- [ ] Implement ERC-4626 vault interface in Rust
- [ ] Implement lending pool (deposit, borrow, repay)
- [ ] Implement utilization-curve interest rate model
- [ ] Implement health factor calculation + liquidation logic
- [ ] Deploy MockOracle (Solidity) + mock tAAPL/tTSLA/tSPY tokens
- [ ] Deploy and test on Robinhood Chain testnet
- [ ] Write basic Hardhat/Foundry tests

### Week 2 — AI Agent + Integration
- [ ] Set up Vibekit agent project
- [ ] Configure agent with vault contract address and ABI
- [ ] Write health monitoring strategy
- [ ] Write liquidation trigger
- [ ] Test weekend price-drop scenario end-to-end
- [ ] Connect frontend to vault (deposit/borrow calls)

### Week 3 — Frontend + Demo Polish
- [ ] Complete dashboard UI
- [ ] Deposit + borrow + lend flows working
- [ ] Agent activity log display
- [ ] Rehearse demo script (weekend scenario)
- [ ] Prepare pitch deck (DTCC macro narrative)
- [ ] Record backup demo video in case testnet has issues

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Robinhood Chain testnet instability | Medium | High | Keep Arbitrum Sepolia fallback; mock Robinhood Chain locally if needed |
| Stylus unfamiliar syntax | Medium | Medium | Use stylus-by-example.org; OpenZeppelin Rust contracts as reference |
| Vibekit agent not triggering reliably | Low | High | Add manual liquidation fallback in UI; agent failure is recoverable |
| Mock oracle price manipulation in demo | None | None | Demo operator controls oracle directly — this is intentional for demo purposes |
| No real tokenized stock tokens on testnet | Low | Medium | Deploy our own mock ERC-20 tokens (tAAPL etc.) if Robinhood hasn't released them |
| Competition submitting similar idea | Medium | Medium | First-mover advantage if submitted early; focus on agent quality as differentiator |

---

## 13. Grant Strategy

### Immediate: Arbitrum Open House London
- Target: Main buildathon prize (reserved Robinhood Chain slot) + AI Agentic prize
- Pitch emphasis: First DeFi yield protocol on Robinhood Chain + Vibekit integration

### 30 Days Post-Hackathon: Trailblazer 2.0
- Eligibility: Vibekit-based DeFi agent + new protocol integration (Robinhood Chain is not yet in Vibekit)
- Application: Submit Tessera as a new Vibekit protocol integration + DeFi agent
- Expected grant: $10K–$50K (individual projects capped at $10K per Trailblazer rules; additional via integration bounty)

### 60 Days Post-Hackathon: Arbitrum Foundation Grant
- Category: DeFi infrastructure + tooling
- Amount: $20K–$150K
- Requirement: Demonstrated traction (TVL, users) — begin at mainnet launch

### Strategic Note
Robinhood committed $1M to the Open House program specifically to fund Robinhood Chain developer activity. Reach out directly to Robinhood's developer relations team post-hackathon — as the first DeFi protocol on their chain, there is a strong mutual interest in supporting Tessera.

---

## 14. Competitive Landscape

| Protocol | Chain | Assets | Yield Type | vs Tessera |
|----------|-------|--------|-----------|----------------|
| Kamino (tokenized stocks) | Solana | Superstate xStocks | Lending | Accredited investors only; not on Arbitrum/Robinhood Chain |
| Aave | Arbitrum One | Crypto assets | Lending | No tokenized stock support; no Robinhood Chain presence |
| Radiant | Arbitrum One | Crypto assets | Lending | Cross-chain but no RWA |
| Ribbon Finance | Ethereum | Crypto assets | Covered calls | No stock tokens; different chain |
| **Tessera** | **Robinhood Chain** | **Tokenized stocks** | **Lending + AI agent** | **First mover; purpose-built** |

---

## 15. Appendix: Key Resources

**Robinhood Chain**
- Docs: https://docs.robinhood.com/chain/
- Faucet: https://faucet.testnet.chain.robinhood.com/
- RPC: (see Robinhood Chain docs for testnet RPC endpoint)

**Arbitrum / Stylus**
- Stylus docs: https://docs.arbitrum.io/stylus
- Stylus by example: https://stylus-by-example.org
- cargo-stylus CLI: https://github.com/OffchainLabs/cargo-stylus
- Stylus Rust SDK: https://github.com/OffchainLabs/stylus-sdk-rs
- OpenZeppelin Rust contracts: https://github.com/OpenZeppelin/rust-contracts-stylus

**Vibekit**
- GitHub: https://github.com/EmberAGI/arbitrum-vibekit
- Trailblazer 2.0 grant: https://blog.arbitrum.foundation/trailblazer-2-0-1m-in-grants-to-power-agentic-defi-on-arbitrum/

**Faucets**
- Arbitrum Sepolia: https://arbitrum.faucet.dev/
- Ethereum Sepolia: https://sepoliafaucet.com/
- Robinhood Chain testnet: https://faucet.testnet.chain.robinhood.com/
- Arbitrum Sepolia USDC: https://faucet.circle.com/

---

# Strategic Suggestions to Improve the Product

## 1. Improve the User Experience (Most Important for Retail Adoption)

Retail users hate complicated DeFi interfaces and technical jargon. The product experience should feel extremely simple and beginner-friendly. Users should immediately understand the value proposition within seconds.

The main user journey should become:

- **Deposit**
- **Earn Yield**
- **AI Protects**

That's it.

Avoid showing too many:

- complex charts
- advanced DeFi metrics
- confusing liquidation numbers

Instead:

- use visual indicators
- AI protection badges
- portfolio safety score
- simple health meters

The product should feel like:

> "A smart AI-powered investing app"

NOT:

> "A complicated crypto protocol."

## 2. Make the AI Layer Truly Intelligent

Right now the AI mainly:

- monitors
- alerts
- liquidates

That's good for MVP. But long-term differentiation requires MUCH more.

The AI should evolve into an **autonomous financial intelligence system**.

### Future AI Features

**Predictive Risk Analysis** — AI predicts danger BEFORE liquidation risk appears.

> Example: "Your TSLA position may become risky due to upcoming earnings volatility."

**News & Sentiment Analysis** — AI analyzes:

- market news
- earnings reports
- macro events
- geopolitical events
- volatility spikes

Then automatically adjusts risk.

**Autonomous Strategy Optimization** — AI dynamically:

- reallocates liquidity
- optimizes yield
- reduces risk exposure

without user intervention.

**Autonomous Hedging** — AI protects users during crashes using:

- hedging strategies
- stablecoin balancing
- volatility protection

**Personalized AI Recommendations**:

- safer leverage suggestions
- yield optimization suggestions
- personalized risk settings

### Long-Term Goal

The AI should become:

> "An autonomous financial strategist."

NOT:

> "Just a liquidation bot."

## 3. Build a Stronger Long-Term Moat

Competitors can eventually copy:

- lending
- borrowing
- vaults

Your REAL moat should become:

- AI intelligence
- autonomous risk engine
- best UX
- deepest liquidity
- safest infrastructure
- strongest trust layer

### The Real Long-Term Vision

Tessera should become:

> "The best autonomous risk engine for tokenized assets and RWAs."

That's the real billion-dollar opportunity.

## 4. Strengthen Product-Market Fit

The project already has strong Product-Market Fit potential because:

- tokenized stocks are growing
- RWAs are trending
- AI agents are trending
- Robinhood Chain is new

BUT users still need clearer emotional reasons to stay.

### Improve User Understanding

Users should instantly understand:

> "Why should I use Tessera?"

Simple answer:

> "Earn passive income on your stocks while AI protects your portfolio 24/7."

That message is powerful.

### Focus On

- passive income
- automation
- safety
- simplicity
- AI protection
