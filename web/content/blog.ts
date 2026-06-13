import type { Block } from "@/components/prose";

export interface BlogPost { title: string; slug: string; date: string; excerpt: string; tags: string[]; blocks: Block[]; }

export const posts: BlogPost[] = [
  {
    "title": "Introducing Tessera: the safest place to borrow against tokenized stocks",
    "slug": "introducing-tessera",
    "date": "2026-06-14",
    "excerpt": "Tokenized stocks trade 24/7, but the market behind them doesn't — so positions gap overnight and people get liquidated in their sleep. Tessera is a lending protocol with an autonomous AI risk layer built to head that off. Here's what we're building, why it matters now, and exactly what's live on testnet today.",
    "tags": [
      "announcement",
      "vision",
      "defi",
      "tokenized-stocks",
      "ai-risk",
      "testnet"
    ],
    "blocks": [
      {
        "type": "p",
        "text": "Today we're introducing **Tessera**: a protocol for borrowing USDC against tokenized stocks, with an autonomous agent watching every position around the clock to head off liquidations before they happen. This post explains what we're building, why the problem is real, why now is the moment, and — just as importantly — exactly what is live today and what is not."
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Tessera is live on testnet only — on Robinhood Chain, an Arbitrum Orbit L2 (chain 46630). It is not open to real funds. Everything below distinguishes plainly between what is running now and what is a mainnet gate (a milestone we have to clear before real money is ever involved).",
        "title": "Where Tessera is today"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "The problem: 24/7 collateral, a market that sleeps"
      },
      {
        "type": "p",
        "text": "Tokenized stocks — on-chain tokens that track real equities like Apple, Tesla, or the S&P 500 — trade every hour of every day. The companies and markets behind them do not. The underlying equity market is open roughly 32 hours a week; the token trades all 168. That mismatch is the whole problem."
      },
      {
        "type": "p",
        "text": "When you borrow against an asset, lenders need a cushion: if your collateral falls in value, your loan can be **liquidated** — sold off to repay the debt — once it crosses a safety line. In normal markets you can watch that line and act. But a tokenized stock can **gap** — jump in price with no trading in between — over a weekend or after a midnight earnings release, when no human is awake and traditional markets are shut. Positions that looked safe at bedtime are liquidated before morning. The borrower never had a chance to react."
      },
      {
        "type": "quote",
        "text": "The collateral trades 24/7. The people who own it, and the market that prices it, do not. Tessera exists to close that gap."
      },
      {
        "type": "h2",
        "text": "The answer: an AI risk layer that never sleeps"
      },
      {
        "type": "p",
        "text": "Tessera has two sides, like any healthy lending market. **Lenders** supply USDC and earn yield from borrower interest. **Borrowers** post tokenized-stock collateral and draw USDC against it — to get liquidity without selling their position. Standard so far. What's different is the layer sitting on top of every borrow."
      },
      {
        "type": "p",
        "text": "We call it **the Watcher** — an autonomous agent that monitors each borrower's **health factor** continuously and steps in before a gap turns into a forced liquidation. The health factor is the single number that matters here: it's your risk-weighted collateral value divided by your debt, scaled so that **1.0 is the liquidation line**. Above 1.0 you're safe; at or below it, your position can be liquidated."
      },
      {
        "type": "h3",
        "text": "What the Watcher does"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "Watches every borrower's health factor around the clock, re-checking roughly every 10 seconds.",
          "Sends plain-English alerts before a position becomes dangerous — not after.",
          "With your explicit opt-in, auto-repays from USDC you have pre-approved, reducing your debt to pull the health factor back up before the liquidation line is reached.",
          "Stamps an on-chain heartbeat as it works, so a permissionless backstop can open only if the agent goes truly silent (over 15 minutes on testnet) — protection that doesn't depend on us being online."
        ]
      },
      {
        "type": "h3",
        "text": "What the Watcher does not do — by design"
      },
      {
        "type": "p",
        "text": "Trust in a system that touches your money comes from its limits, not its promises. So we are precise about what the Watcher cannot do:"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "It never custodies your funds. It can only reduce your own debt, using an allowance you set — and can revoke at any time. Revoking is the single kill switch.",
          "It does not use a language model to decide whether to move money. A deterministic core makes every financial decision; the language model only writes the human-readable copy you read in alerts.",
          "It is bounded by hard, on-chain caps: at most 10,000 USDC per user per transaction and 25,000 USDC per user per day. The limits live in the contract, not in a config file we control.",
          "It cannot guarantee protection. A severe enough overnight gap can still liquidate a position. We will never pretend otherwise."
        ]
      },
      {
        "type": "callout",
        "tone": "warning",
        "body": "This is the design decision we care most about. The money-moving logic is deterministic and on-chain-bounded — auditable, predictable, and capped. The AI's job is to explain, in plain English, what that logic is doing and why. We use AI where it's safe to be wrong (wording) and never where it isn't (moving funds).",
        "title": "Deterministic core, AI for language only"
      },
      {
        "type": "h2",
        "text": "Conservative by default"
      },
      {
        "type": "p",
        "text": "Because overnight gaps are the core risk, our risk parameters are deliberately cautious — more conservative than a typical crypto money market. Each asset has a **max LTV** (the most you can borrow against it) and a **liquidation threshold** (the point at which liquidation can begin), both set with gap risk in mind:"
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
        "type": "p",
        "text": "A few more parameters that shape the system: the **liquidator bonus** starts at 5% and ramps with depth; the **close factor** is 50%, so a single liquidation can clear at most half a position — except below a health factor of 0.95, where a full close is allowed. The **minimum debt** is 100 USDC to avoid uneconomical dust positions. And a **reserve factor** of 15% of borrow interest is routed to an on-chain reserve that serves as both protocol revenue and a first-loss buffer."
      },
      {
        "type": "callout",
        "tone": "success",
        "body": "Tessera will never launch a token. Our revenue is the 15% reserve factor on interest paid by borrowers — a transparent cut of real economic activity, not a coin sale. That keeps our incentives pointed at one thing: a lending market that works.",
        "title": "No token. Ever."
      },
      {
        "type": "h2",
        "text": "Why now"
      },
      {
        "type": "p",
        "text": "Tokenized equities are moving from a niche experiment to real infrastructure, and the rails to issue and trade them on-chain are arriving faster than the risk tooling around them. As more people hold tokens that trade continuously against a market that doesn't, the overnight-gap problem stops being theoretical and starts liquidating real positions. The safety layer needs to exist before the volume does — not after the first bad weekend."
      },
      {
        "type": "p",
        "text": "We also chose our chain for a concrete engineering reason. Tessera's vault is large because it is safety-hardened, and it exceeds the contract-size limit of a standard L2. Robinhood Chain — an Arbitrum Orbit L2 — has a larger code-size limit that holds the full vault without us stripping out safety logic to fit. The vault and its supporting contracts are written in **Rust via Arbitrum Stylus**, which gives us the headroom and the gas efficiency to run conservative, frequently-checked risk logic on-chain."
      },
      {
        "type": "h2",
        "text": "What's actually live today"
      },
      {
        "type": "p",
        "text": "Everything below is running on Robinhood Chain testnet right now, end to end:"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "The Stylus (Rust) vault — supply, borrow, repay, and liquidation logic with the conservative parameters above.",
          "A PriceGuard contract — an oracle-policy layer that governs how prices are allowed to move into the system.",
          "A Lens — a read-only contract that surfaces clean, structured position and market data to the app.",
          "The Watcher — the TypeScript agent doing live health-factor monitoring, alerting, and opt-in auto-repay within its on-chain caps and heartbeat backstop.",
          "All of it open-source, so the claims in this post can be checked against the code."
        ]
      },
      {
        "type": "callout",
        "tone": "danger",
        "body": "Tessera is testnet-only and not open to real funds. It has not been audited. It has no real users, no TVL, no returns, and no insurance — we will not claim any of those. The on-chain price feed today is a testnet mock; a real, licensed price feed is a mainnet gate, not something shipped. Tessera is also not available to US persons or to sanctioned jurisdictions.",
        "title": "Honest mainnet gates"
      },
      {
        "type": "h2",
        "text": "What's next"
      },
      {
        "type": "p",
        "text": "Our path is gated, not hyped. Before real funds are ever involved we need to clear the work that justifies that trust: a licensed production price feed in place of the testnet mock, a security audit, and the operational hardening that turns a working testnet protocol into something people can responsibly depend on. We'll name each of these as a gate as we reach it — and we'll keep building in the open so progress is visible, not announced."
      },
      {
        "type": "p",
        "text": "The long-term vision is straightforward: become the autonomous AI risk layer for tokenized real-world-asset lending. Tokenized assets that trade continuously need risk infrastructure that does the same. That's the durable problem, and it's the one we intend to keep solving."
      },
      {
        "type": "divider"
      },
      {
        "type": "p",
        "text": "If the problem resonates — you hold tokenized stocks and want liquidity without getting liquidated overnight, or you want to lend USDC into a market with a real safety story — follow along as we build. The code is open, the parameters are public, and the testnet is live."
      },
      {
        "type": "quote",
        "text": "Tessera — the safest place to borrow against tokenized stocks."
      }
    ]
  },
  {
    "title": "How the Watcher Works: An Autonomous Risk Agent With a Deterministic Core",
    "slug": "how-the-watcher-works",
    "date": "2026-06-11",
    "excerpt": "A walkthrough of Tessera's autonomous risk agent — the deterministic core that decides whether to move money, the strict boundary that keeps the language model out of those decisions, the per-block monitoring loop, opt-in auto-repay bounded by on-chain caps, and a heartbeat-gated backstop. Including the honest limits.",
    "tags": [
      "engineering",
      "ai-risk",
      "architecture",
      "security",
      "arbitrum"
    ],
    "blocks": [
      {
        "type": "p",
        "text": "Tokenized stocks trade 24/7, but the company behind the stock doesn't. The underlying market closes; the token keeps moving. A position that looked safe on Friday can gap through its liquidation line over the weekend, and the borrower wakes up liquidated — often paying a penalty on top. The structural answer is not a louder alert. It is an agent that watches every position continuously and, with your permission, acts before the line is crossed."
      },
      {
        "type": "p",
        "text": "We call that agent **the Watcher**. This post explains exactly how it works: what decides to move money (a deterministic core), what never does (the language model), how often it looks (about every 10 seconds), how it can repay your debt without ever holding your funds, and what happens if the agent itself goes down. We will also be clear about what it cannot do."
      },
      {
        "type": "callout",
        "tone": "warning",
        "body": "Tessera runs on Robinhood Chain (an Arbitrum Orbit L2, chain 46630) and is not open to real funds. The on-chain price feed is a testnet mock today; a real licensed feed is a mainnet gate. The permissionless backstop described below is built but disabled on testnet (delay = 0, agent-only). Everything else here is running code.",
        "title": "Status: live on testnet only"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "The one idea that matters: a deterministic core, a language model on the edge"
      },
      {
        "type": "p",
        "text": "Most \"AI agent\" products let a language model decide what to do and then do it. That is fine for drafting an email. It is not acceptable when the action is spending your money. Language models are non-deterministic, they can be steered by crafted inputs, and they cannot be formally reasoned about. We do not want any of that anywhere near a transaction."
      },
      {
        "type": "p",
        "text": "So the Watcher is split in two, with a hard wall between the halves:"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "**The deterministic core** decides *whether* to act and *how much* to repay. It is plain, testable arithmetic on numbers read from the chain — no model in the loop, no randomness. Given the same inputs it always reaches the same decision.",
          "**The language model** only writes the sentence a human reads. It turns structured facts (a safety score, a risk band) into one calm, plain-English line. It never sees a private key, never chooses an amount, and never triggers a transaction."
        ]
      },
      {
        "type": "p",
        "text": "Concretely: the function that generates alert copy is the *only* place the model is invoked. The health classification, the repay sizing, and the transaction itself live in separate modules that never call it. The model's prompt forbids inventing any fact, and if the model is slow, errors, or has no API key at all, the agent falls back to a deterministic template that echoes the same numbers. A degraded model can make the prose blander. It can never corrupt a decision or a dollar amount."
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Because clear, reassuring, human language is genuinely better than a template at 3am — but only for the words. We treat the model the way a newsroom treats a copy editor: it can rewrite the sentence, it cannot change the facts. The facts come from the chain and the deterministic core.",
        "title": "Why route the copy through a model at all?"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "Health factor: the one number everything keys off"
      },
      {
        "type": "p",
        "text": "Before the loop makes sense, you need one term. The **health factor (HF)** is your risk-weighted collateral value divided by your debt, scaled so that **1.0 is the liquidation line**. Above 1.0 you are solvent; the higher, the safer. At or below 1.0 the position can be liquidated. Everything the Watcher does is a reaction to where your HF sits and which direction it is heading."
      },
      {
        "type": "p",
        "text": "The core sorts every position into a band purely from its HF — no judgment calls, just thresholds:"
      },
      {
        "type": "table",
        "headers": [
          "Health factor",
          "Band",
          "What the Watcher does"
        ],
        "rows": [
          [
            "1.5 and above",
            "Safe",
            "Watches. No action."
          ],
          [
            "1.2 to 1.5",
            "Healthy",
            "Watches. Comfortable buffer."
          ],
          [
            "1.1 to 1.2",
            "Watch",
            "Monitors closely; may alert."
          ],
          [
            "1.0 to 1.1",
            "At risk",
            "Alerts; auto-repays if you opted in."
          ],
          [
            "Below 1.0",
            "Liquidating",
            "Position is wound down to protect lenders."
          ]
        ]
      },
      {
        "type": "p",
        "text": "The same HF also produces a 0–100 **Safety Score** that we show users instead of jargon — it is a direct rescaling of the health factor, computed with exact fixed-point math so it never drifts from the on-chain truth."
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "The loop: one coherent snapshot, about every 10 seconds"
      },
      {
        "type": "p",
        "text": "The Watcher runs a tick loop with a default interval of 10 seconds (`pollIntervalMs: 10_000`). Each tick is one self-contained pass that never throws — any error is recorded as a structured log entry and the loop continues. A single tick does five things:"
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          "**Pin a block.** It reads the current block number once and uses it for every read in the tick, so the whole pass reflects a single, coherent snapshot of the chain rather than a smear of different moments.",
          "**Find the borrowers.** A lightweight event indexer tracks who currently has debt, persisting its progress so it survives restarts. Repaid positions are dropped from the active set; a re-borrow re-activates instantly.",
          "**Batch-read health.** It reads HF and debt for every tracked borrower in a single multicall at the pinned block (one round trip, not two per user), falling back to per-user reads if multicall is unavailable.",
          "**Triage.** Zero-debt positions are evicted. Healthy positions are cleared. The at-risk subset is collected and sorted most-endangered-first, so the position closest to the line is handled before the next tick begins.",
          "**Act.** For each at-risk position, in order: liquidate if it is already below 1.0; otherwise (if opted in) auto-repay to restore the buffer; then send a plain-English alert."
        ]
      },
      {
        "type": "callout",
        "tone": "danger",
        "body": "If an HF read fails — for example, a non-archive RPC rejecting a read at the pinned block — the position is counted as a read failure and escalated to a critical on-call page. We never treat an unreadable position as 'fine'. Being knowingly degraded is acceptable; being silently blind is not. The agent even probes the RPC for archive support at startup and warns loudly if it is missing.",
        "title": "A blind spot is treated as an incident, not a pass"
      },
      {
        "type": "h3",
        "text": "Acting ahead of the gap, not after it"
      },
      {
        "type": "p",
        "text": "Because the whole point is the overnight and weekend gap, the core widens its protection target when the underlying equity market is closed, on a weekend, or near an earnings date. The thresholds it aims for are pushed higher in those windows, so a position is restored to a bigger buffer and protection kicks in *earlier* than a static rule would allow. This regime adjustment is — like everything else in the core — deterministic; the model has no part in it."
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "Auto-repay: spending your money without ever holding it"
      },
      {
        "type": "p",
        "text": "This is the differentiator, and it is also the part that demands the most care, because it moves funds. Here is the model that keeps it safe: the Watcher can reduce *your* debt using *your* pre-approved USDC, and it can do literally nothing else with those funds."
      },
      {
        "type": "p",
        "text": "When you opt in, you grant a standard ERC-20 allowance of USDC to the vault. That allowance is the spending ceiling. The agent calls a single permissioned vault entrypoint, `agentRepayFor(user, amount)`, which the contract enforces can only ever *reduce* that user's debt with that user's own approved funds. It cannot withdraw, transfer, or extract value of any kind. The Watcher never custodies anything."
      },
      {
        "type": "p",
        "text": "Every auto-repay passes through the same five-step safety pipeline as a liquidation, so all autonomous money movement goes through one audited path:"
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          "**Idempotency** — at most one action per user per block, so a position can't be repaid twice in the same moment.",
          "**Budget** — the agent may pull at most `min(needed, your allowance, your balance)`. A zero allowance means you haven't opted in (or you revoked), and it does nothing.",
          "**Gas cap** — if gas price exceeds the configured ceiling, it skips rather than overpay.",
          "**Simulation** — it runs the exact `agentRepayFor` call as an `eth_call` first and only proceeds if it would succeed, so it never broadcasts a transaction it expects to revert.",
          "**Submit and confirm** — only then does it broadcast, then waits for the receipt so an on-chain revert is never logged as a successful repay."
        ]
      },
      {
        "type": "p",
        "text": "The repay amount is computed, not guessed. The core sizes it to lift your health factor back to the protection target — `repay = debt × (target − HF) ÷ target` — and the reasoning (which regime, which HF, the math) is written into a public action log so every autonomous move is auditable after the fact."
      },
      {
        "type": "h3",
        "text": "On-chain caps: defending against a compromised key, not just buggy code"
      },
      {
        "type": "p",
        "text": "The agent's own pipeline is careful, but careful code is not a security boundary — the agent's signing key could be stolen. So the real limits are enforced *on-chain by the vault itself*, where the agent's behavior is irrelevant:"
      },
      {
        "type": "table",
        "headers": [
          "Cap",
          "Limit",
          "Enforced where"
        ],
        "rows": [
          [
            "Per user, per transaction",
            "10,000 USDC",
            "Vault contract"
          ],
          [
            "Per user, per day",
            "25,000 USDC",
            "Vault contract"
          ],
          [
            "Total ceiling",
            "Your ERC-20 allowance",
            "Vault contract"
          ]
        ]
      },
      {
        "type": "p",
        "text": "The per-user, per-day cap is charged inside `agentRepayFor` precisely so that a compromised agent *key* — not just compliant agent code — cannot drain a user's full allowance in one burst. The contract caps the spend regardless of what the off-chain agent tries to do."
      },
      {
        "type": "callout",
        "tone": "success",
        "body": "To turn the Watcher off entirely, revoke the USDC allowance. The moment it is zero, auto-repay does nothing — the budget check fails first. There is also a separate on-chain admin fail-safe at the protocol level. You are never locked into the agent's protection.",
        "title": "The kill switch is one transaction"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "The heartbeat and the backstop: what if the agent dies?"
      },
      {
        "type": "p",
        "text": "An autonomous protector raises an obvious question: what protects you when the protector is down? Our answer is a dead-man's switch built into the vault."
      },
      {
        "type": "p",
        "text": "The agent stamps an on-chain **heartbeat** on a slow cadence (default every 3 minutes), even on quiet ticks where it took no action. Liquidations and auto-repays stamp it too, so the heartbeat only matters during genuinely idle periods. The point is to distinguish a *live-but-idle* agent (nothing to do) from a *dead* one (process crashed, key gone, host offline)."
      },
      {
        "type": "p",
        "text": "On top of that sits a **permissionless backstop**. When enabled, if the agent's heartbeat goes silent past a configured delay (on testnet the design target is more than 15 minutes), liquidation opens up to anyone — not just the agent — so a frozen agent can never trap an unhealthy position. Crucially, a backstop liquidation runs the *identical* close-factor, bonus, and post-liquidation health-improvement guards as an agent liquidation, so it is provably as safe as the normal path; it just removes the single point of failure."
      },
      {
        "type": "callout",
        "tone": "warning",
        "body": "The backstop delay is currently 0, which keeps liquidation strictly agent-only — the conservative MVP default. The heartbeat is already being stamped today so the machinery is proven and ready; flipping the delay to a positive value is an explicit mainnet gate, taken at the audited mainnet build, not something silently live now.",
        "title": "On testnet the backstop is intentionally off"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "The honest limits"
      },
      {
        "type": "p",
        "text": "We would rather lose your trust to clarity than to a surprise, so here is what the Watcher does not and cannot do."
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "**It cannot guarantee you won't be liquidated.** A severe enough gap — the token falling straight through your liquidation line faster than a repay can land, or with no funds left in your allowance — can still liquidate a position. The Watcher reduces the odds and acts early; it does not repeal market risk.",
          "**It never decides with a language model whether to move money.** Every financial decision is made by deterministic code. The model only writes the human-readable sentence.",
          "**It never custodies funds.** It can only reduce your own debt via an allowance you set and can revoke at any time.",
          "**It depends on a working price feed and RPC.** On testnet the price feed is a mock; a licensed feed is a mainnet gate. If the agent goes blind on a read, it escalates rather than guesses.",
          "**It is testnet software.** No audit, no real funds, no real users, no returns, no insurance. Those are mainnet gates, named as such — never implied as shipped."
        ]
      },
      {
        "type": "p",
        "text": "The design philosophy underneath all of this is simple: the more autonomous a system is, the more conservative its boundaries must be. The Watcher is given exactly one power — to reduce your debt with your own pre-approved funds, bounded by caps the contract enforces — and a clean way to be switched off. Everything intelligent happens inside those walls; nothing important depends on a language model behaving."
      },
      {
        "type": "p",
        "text": "Tessera is open-source. The agent, the vault, the price-policy contract, and the read-only data layer are all public, so none of the above has to be taken on faith — it can be read."
      },
      {
        "type": "quote",
        "text": "The safest place to borrow against tokenized stocks."
      }
    ]
  },
  {
    "title": "Why 24/7 Tokenized Stocks Gap — and Liquidate People in Their Sleep",
    "slug": "why-tokenized-stocks-gap",
    "date": "2026-06-08",
    "excerpt": "Tokenized stocks trade around the clock, but the real market behind them only reprices in trading hours. That mismatch creates overnight and weekend price gaps that wreck naively designed loans. Here is why it happens, and how conservative loan limits plus a continuous AI risk layer address it.",
    "tags": [
      "tokenized stocks",
      "DeFi lending",
      "liquidations",
      "risk management",
      "RWA",
      "Tessera"
    ],
    "blocks": [
      {
        "type": "p",
        "text": "Tokenized stocks are one of the more genuinely useful things to arrive on-chain: a token like **tAAPL** or **tTSLA** that tracks a real equity and can be held, moved, or borrowed against at any hour. But that around-the-clock availability hides a structural mismatch that quietly liquidates people. This post explains the mismatch in plain English, shows why ordinary lending designs are fragile because of it, and lays out the two things that actually help — conservative, gap-aware loan limits and a risk layer that watches positions continuously."
      },
      {
        "type": "h2",
        "text": "The core mismatch: the token trades 24/7, the market doesn't"
      },
      {
        "type": "p",
        "text": "A tokenized stock can change hands at 3 a.m. on a Sunday. The company behind it cannot. The New York Stock Exchange and Nasdaq are open roughly **9:30 a.m. to 4:00 p.m. Eastern, Monday to Friday**, with holidays off. That is about a third of the week. For the other two-thirds, the real price discovery that sets what Apple or Tesla is worth simply isn't happening."
      },
      {
        "type": "p",
        "text": "So during the hours the underlying market is closed, an on-chain tokenized stock is trading against stale information. When the market reopens and absorbs everything that happened while it was shut — an earnings miss, a macro shock, a weekend headline — the price can **jump in a single step** rather than drift there smoothly. That single step is called a **gap**."
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "A gap is a discontinuous jump in price between one market session's close and the next session's open, with little or no trading in between. The price doesn't travel through the levels in the middle — it teleports past them. There is no chance to react on the way down because there is no \"on the way down.\"",
        "title": "What a \"gap\" is"
      },
      {
        "type": "h2",
        "text": "Why gaps specifically wreck loans"
      },
      {
        "type": "p",
        "text": "Lending against a volatile asset works on a simple promise: the collateral is worth comfortably more than the debt, and if it starts slipping toward the debt, the loan is unwound in small, orderly steps before it goes underwater. That promise quietly assumes prices move **continuously** — that you get a chance to act between \"healthy\" and \"insolvent.\""
      },
      {
        "type": "p",
        "text": "Gaps break that assumption. The price can cross the danger zone in one move while the borrower is asleep and the underlying market is closed. By the time anything can respond, the position may already be past the point where it should have been protected. This is not a tail risk you can engineer away; it is a property of the asset. Tokenized equities will gap. The only real questions are how much room you leave for it, and what is watching when it happens."
      },
      {
        "type": "h3",
        "text": "A concrete example"
      },
      {
        "type": "p",
        "text": "Suppose a protocol lets you borrow up to 80% of your collateral's value — generous, the kind of number that looks competitive in a table. You post $1,000 of a tokenized stock and borrow $800. On Friday afternoon everything looks fine. Over the weekend the underlying drops 15% on news. Monday's open reprices your collateral to $850. Your $800 debt is now backed by $850 — and after the liquidation penalty, you're effectively underwater. You never had a chance to add collateral or repay, because the move happened while the market was shut. A naive 80% loan didn't fail because the borrower was careless. It failed because the design assumed a world without gaps."
      },
      {
        "type": "h2",
        "text": "First answer: conservative, gap-aware loan limits"
      },
      {
        "type": "p",
        "text": "The first defense is unglamorous and the most important: leave real room. Two numbers govern this."
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "**Maximum loan-to-value (LTV)** — the most you can borrow against your collateral when you open the loan. A 50% max LTV on $1,000 of collateral means you can borrow at most $500.",
          "**Liquidation threshold** — the point at which the loan is eligible to be unwound. It sits above the max LTV; the space between the two is your safety buffer, the room a gap can move into before anything is forced."
        ]
      },
      {
        "type": "p",
        "text": "Most DeFi lending was tuned for crypto assets that trade continuously, so it could afford thin buffers. Tokenized stocks need the opposite: limits set deliberately low so that a realistic overnight or weekend gap lands inside the buffer instead of blowing through it. Tessera's parameters are tuned for exactly this — and they differ by asset, because a single stock gaps harder than a broad index."
      },
      {
        "type": "table",
        "headers": [
          "Collateral",
          "Max LTV",
          "Liquidation threshold",
          "Why this level"
        ],
        "rows": [
          [
            "tAAPL (Apple)",
            "50%",
            "65%",
            "Single large-cap stock; earnings and headline risk gap a single name hard."
          ],
          [
            "tTSLA (Tesla)",
            "40%",
            "55%",
            "Higher single-name volatility, so the buffer is wider still."
          ],
          [
            "tSPY (S&P 500 ETF)",
            "60%",
            "75%",
            "A broad index diversifies away single-stock shocks, so a bit more room is justified."
          ]
        ]
      },
      {
        "type": "p",
        "text": "Read tTSLA as the clearest statement of intent: you can borrow at most 40% of your collateral, and nothing is liquidated until 55%. That 15-point gap is room left on purpose for a weekend that goes wrong."
      },
      {
        "type": "p",
        "text": "When a position does have to be unwound, the mechanics are kept orderly too. A liquidator earns a **5% base bonus** (which ramps with depth, so distressed positions still get cleared), only **50% of a position** can be closed in one step under normal conditions — a full close is reserved for positions that fall below a health factor of **0.95** — and there's a **100 USDC minimum debt** so positions never fragment into uneconomical dust. None of this prevents a gap. It limits the damage when one arrives."
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Health factor (HF) is your risk-weighted collateral value divided by your debt, scaled so that 1.0 is exactly the liquidation line. Above 1.0 you have room; at 1.0 you're at the edge; below it the position is eligible to be unwound. Conservative LTVs are simply a way of starting every loan with a comfortable HF cushion.",
        "title": "Health factor, in one line"
      },
      {
        "type": "h2",
        "text": "Second answer: a risk layer that never sleeps"
      },
      {
        "type": "p",
        "text": "Conservative limits buy room. They don't buy attention. The other half of the problem is that gaps happen precisely when no human is watching — overnight, over weekends, over holidays. So the protection has to be continuous and automatic, not a dashboard you're expected to babysit."
      },
      {
        "type": "p",
        "text": "This is the role of **the Watcher**, Tessera's autonomous risk agent. It re-checks every borrower's health factor about **every 10 seconds**, around the clock. As a position drifts toward danger it sends **plain-English alerts** — not a wall of numbers — so you understand what's happening and why. And if you've opted in, it can **auto-repay from USDC you pre-approved** to pull a position back from the edge before it crosses the liquidation line, without you having to wake up and do it yourself."
      },
      {
        "type": "p",
        "text": "An agent that can move money is only trustworthy if its limits are real and enforced by the chain, not by good intentions. So the Watcher is boxed in on every side:"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "**It never custodies your funds.** It can only reduce your own debt, and only through an allowance you set and can revoke at any moment. Revoking that allowance is the single kill switch.",
          "**An AI model never decides to move money.** A deterministic core makes every financial decision from on-chain state; the language model only writes the human-readable alerts. The copy is AI; the choice to act is not.",
          "**Hard on-chain caps bound it.** Auto-repay is limited to 25,000 USDC per user per day and 10,000 USDC per user per transaction — enforced by the contract, not by the agent's own restraint.",
          "**It can't disappear silently.** The agent stamps an on-chain heartbeat. If it goes truly quiet (more than 15 minutes on testnet), a permissionless backstop opens so the system isn't dependent on one piece of software staying alive. There is also an on-chain admin fail-safe."
        ]
      },
      {
        "type": "callout",
        "tone": "warning",
        "body": "It cannot guarantee protection. A gap large and fast enough can still cross the liquidation line before any repayment can land — that is the nature of a discontinuous move. The Watcher's job is to make protection the default and to act far earlier and far more consistently than a human could, not to promise that liquidation is impossible. No honest system can promise that.",
        "title": "What the Watcher cannot do"
      },
      {
        "type": "h2",
        "text": "Why both halves are needed"
      },
      {
        "type": "p",
        "text": "Conservative limits without a watcher leave you safe but unattended: the buffer is there, but nothing acts inside it until it's already breached. A watcher without conservative limits leaves you attended but exposed: something is paying attention, but a single gap can outrun any response because there was no room to begin with. The structural answer to 24/7 tokenized-stock lending is both at once — wide, gap-aware buffers that give a position room, and a continuous, bounded agent that uses that room before the market reopens and reprices everything."
      },
      {
        "type": "divider"
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Tessera is live on testnet only — Robinhood Chain, an Arbitrum Orbit L2 (chain 46630). It is not open to real funds. The on-chain price feed used today is a testnet mock; integrating a real, licensed market-data feed is a mainnet gate, not something shipped. Tessera is open-source and has no token, and never will — protocol revenue comes solely from a 15% reserve factor on borrow interest, which also seeds a first-loss reserve. Not available to US persons or sanctioned jurisdictions.",
        "title": "Where Tessera actually stands today"
      },
      {
        "type": "quote",
        "text": "Tessera: the safest place to borrow against tokenized stocks."
      }
    ]
  },
  {
    "title": "Build Log #1: Three contracts, one Watcher, and the road to mainnet",
    "slug": "build-log-01",
    "date": "2026-06-13",
    "excerpt": "What we shipped to get Tessera live on testnet — a three-contract architecture, an autonomous risk agent with a permissionless backstop, and the honest disclosures that come with both. Plus what we learned, and the four gates between us and real money.",
    "tags": [
      "build-in-public",
      "architecture",
      "ai-agent",
      "roadmap",
      "testnet"
    ],
    "blocks": [
      {
        "type": "p",
        "text": "This is the first in a series of build logs we'll publish as Tessera comes together. The goal is simple: show our work. What shipped, what we learned, and what stands between here and a protocol that can safely hold real money. We'd rather be judged by what we ship than by what we promise."
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Tessera is live on testnet — Robinhood Chain, an Arbitrum Orbit L2 (chain 46630). It is not open to real funds. Everything below runs end-to-end on testnet. The items we haven't finished are named as mainnet gates, not implied as done.",
        "title": "Where Tessera stands today"
      },
      {
        "type": "h2",
        "text": "What Tessera is, in one breath"
      },
      {
        "type": "p",
        "text": "You borrow USDC against tokenized stocks — **tAAPL**, **tTSLA**, **tSPY** — and an autonomous agent we call **the Watcher** watches every position around the clock to head off liquidations before they happen. Lenders supply USDC and earn yield; borrowers post tokenized-stock collateral and borrow against it. The tagline we hold ourselves to: **the safest place to borrow against tokenized stocks.**"
      },
      {
        "type": "p",
        "text": "The reason this needs to exist: tokenized stocks trade 24/7, but the market behind them doesn't. A position that's healthy on Friday afternoon can gap through its liquidation line over a weekend, while the holder is asleep. A continuous AI risk layer is the structural answer to a structural problem."
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "What we shipped"
      },
      {
        "type": "h3",
        "text": "1. A three-contract architecture"
      },
      {
        "type": "p",
        "text": "We deliberately kept the on-chain system small and separated by concern. Three contracts, each with one job, plus an off-chain agent that has no special powers it can't be stopped from using."
      },
      {
        "type": "table",
        "headers": [
          "Component",
          "Built in",
          "Responsibility"
        ],
        "rows": [
          [
            "Vault",
            "Arbitrum Stylus (Rust)",
            "Holds collateral and debt; enforces LTVs, the liquidation threshold, and every safety bound. The trust core."
          ],
          [
            "PriceGuard",
            "Stylus (Rust)",
            "An oracle-policy contract the vault prices through — a sanity layer between a raw feed and a financial decision."
          ],
          [
            "Lens",
            "Stylus (Rust)",
            "Read-only data: account views and ERC-4626-style quoting. No state changes, so it can never be an attack surface."
          ],
          [
            "The Watcher",
            "TypeScript agent",
            "Off-chain. Watches health factors, alerts, and (with opt-in) auto-repays — but only through the vault's permissioned entrypoints."
          ]
        ]
      },
      {
        "type": "p",
        "text": "Writing the vault in Rust on **Arbitrum Stylus** wasn't a fashion choice. The full, safety-hardened vault is large — large enough that it exceeds a standard L2's 24KB contract-size cap. Robinhood Chain's larger code-size limit is what lets us ship the complete safety logic on-chain rather than trimming it to fit. The whole stack is open-source."
      },
      {
        "type": "p",
        "text": "Splitting pricing into its own **PriceGuard** contract matters for an honest reason: the on-chain price feed today is a testnet mock. Isolating the policy that consumes the feed means swapping in a real, licensed feed at mainnet is a contained change, not a rewrite of the vault."
      },
      {
        "type": "callout",
        "tone": "warning",
        "body": "The on-chain feed is a testnet mock today. A real, licensed market-data feed is a mainnet gate. PriceGuard exists precisely so that swap is a clean, auditable change — but until it lands, no price on the system reflects a real market.",
        "title": "On the price feed"
      },
      {
        "type": "h3",
        "text": "2. The Watcher — and a backstop for when it goes quiet"
      },
      {
        "type": "p",
        "text": "The Watcher re-checks every borrower's **health factor** (collateral value, risk-weighted, divided by debt — scaled so 1.0 is the liquidation line) about every ten seconds. When a position drifts toward danger it sends a plain-English alert. If you've opted in, it can auto-repay from USDC you pre-approved, heading off a liquidation before it happens."
      },
      {
        "type": "p",
        "text": "What earns trust here isn't what the agent can do — it's what it structurally cannot do. The bounds are enforced on-chain, not by the agent's good behavior:"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "It never custodies your funds. It can only reduce your own debt, using an allowance you set and can revoke at any time.",
          "It never uses a language model to decide whether to move money. A deterministic core makes every financial decision; the LLM only writes the human-readable alert copy.",
          "Its auto-repay is capped on-chain: 25,000 USDC per user per day, 10,000 USDC per user per transaction. The agent cannot exceed these caps even if it wanted to.",
          "It cannot guarantee protection. A severe enough overnight gap can still liquidate a position — and we say so plainly."
        ]
      },
      {
        "type": "p",
        "text": "The piece we're most pleased with is the **heartbeat backstop**. The Watcher stamps an on-chain heartbeat as it runs. If it goes truly silent — more than 15 minutes on testnet — a permissionless backstop opens so the protocol's safety doesn't depend on our agent staying up. The system degrades to ordinary, anyone-can-call liquidation rather than to nothing. An autonomous agent you have to trust to never crash isn't a safety feature; one that fails safe is."
      },
      {
        "type": "p",
        "text": "Your kill switch is a single action: revoke the allowance. There's also an on-chain admin fail-safe so the protocol can stop the agent instantly. We disclose that admin power exists rather than pretending the system is more trustless than it is today."
      },
      {
        "type": "h3",
        "text": "3. Conservative, gap-aware risk parameters"
      },
      {
        "type": "p",
        "text": "Because the core risk is overnight gaps, the loan-to-value (LTV) limits are deliberately conservative and asset-specific — tighter for the more volatile names. These are the real on-chain values."
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
          "Parameter",
          "Value",
          "Why"
        ],
        "rows": [
          [
            "Liquidator bonus",
            "5% base (ramps with depth)",
            "Pays liquidators enough to act, scaling with how underwater a position is."
          ],
          [
            "Close factor",
            "50% (full close below HF 0.95)",
            "A normal liquidation takes at most half the position; only deeply unhealthy positions close fully."
          ],
          [
            "Reserve factor",
            "15% of borrow interest",
            "Protocol revenue and first-loss reserve, in one transparent line."
          ],
          [
            "Minimum debt",
            "100 USDC",
            "A dust floor that keeps positions economically liquidatable."
          ]
        ]
      },
      {
        "type": "callout",
        "tone": "info",
        "body": "Tessera will never launch a token. Revenue is the 15% reserve factor on borrow interest — never a coin sale. That single decision removes a large category of misaligned incentives, and we'd rather make it loudly than quietly.",
        "title": "No token, ever"
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "What we learned"
      },
      {
        "type": "p",
        "text": "**Fitting the full safety logic on-chain is a design constraint, not an afterthought.** The vault grew as we hardened it, and the 24KB cap forced an early decision: trim the safety checks, or pick a chain that lets us keep them. We chose to keep them. Stylus and Robinhood Chain's larger code-size limit made that possible without contortions."
      },
      {
        "type": "p",
        "text": "**Autonomy is only trustworthy if it fails safe.** The first version of the Watcher was a smart agent with a lot of responsibility. The version we shipped is a bounded agent the protocol doesn't depend on. The on-chain caps and the heartbeat backstop did more for our confidence than any amount of additional agent cleverness."
      },
      {
        "type": "p",
        "text": "**Keeping the LLM away from money clarified the whole design.** Once we drew a hard line — deterministic core decides, language model only explains — a lot of ambiguity disappeared. The AI's job is to make the system legible to a human, not to be trusted with the human's balance."
      },
      {
        "type": "p",
        "text": "**Honesty is the cheapest moat to build and the hardest to fake.** Stating plainly that the feed is a mock, that an admin fail-safe exists, that a bad gap can still liquidate you — none of it cost us anything except the temptation to overclaim. It's also the part a sophisticated reader checks first."
      },
      {
        "type": "divider"
      },
      {
        "type": "h2",
        "text": "What's next: the road to mainnet"
      },
      {
        "type": "p",
        "text": "We won't open Tessera to real funds until four gates are cleared. None of these are done. We're naming them so there's no ambiguity about what \"live on testnet\" does and doesn't mean."
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          "**Audit.** An independent security audit of the vault, PriceGuard, and Lens. We make no audit claims today because we don't have one yet.",
          "**Live price feed.** Replacing the testnet mock with a real, licensed market-data feed routed through PriceGuard.",
          "**Legal.** Counsel-reviewed terms and a clear regional posture before any real-money access. Tessera is not available to US persons or sanctioned jurisdictions.",
          "**Reserve.** Capitalizing the first-loss reserve so the protocol can absorb the kind of loss it's designed to survive — not just describe one."
        ]
      },
      {
        "type": "callout",
        "tone": "danger",
        "body": "Until the audit, the live feed, the legal review, and the reserve are all in place, Tessera should be used only with testnet funds. We will say clearly, in a build log like this one, when each gate is cleared.",
        "title": "Read this as a caveat, not a roadmap teaser"
      },
      {
        "type": "p",
        "text": "That's build log #1. The architecture is in place, the Watcher is running on testnet with its backstop, and the gates ahead are named. If you want to follow along — or pressure-test our claims — the code is open-source, and the next log will cover progress against these four gates."
      },
      {
        "type": "quote",
        "text": "We'd rather lose a user to clarity than to a surprise."
      }
    ]
  }
];

export function getPost(slug: string): BlogPost | undefined { return posts.find((p) => p.slug === slug); }
