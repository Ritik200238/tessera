import type { DocGroup } from "@/components/docs-layout";

export const docGroups: DocGroup[] = [
  {
    "title": "Getting started",
    "sections": [
      {
        "title": "Overview",
        "slug": "overview",
        "blocks": [
          {
            "type": "p",
            "text": "Tessera is a DeFi lending protocol for tokenized stocks on Robinhood Chain. Borrow USDC against tAAPL, tTSLA, or tSPY; earn USDC yield by supplying liquidity. The autonomous AI agent called the Watcher monitors every position 24/7 and prevents liquidations before they happen."
          },
          {
            "type": "h3",
            "text": "The Problem"
          },
          {
            "type": "p",
            "text": "Tokenized stocks trade 24/7 on Robinhood Chain, but the underlying US stock market closes at 4 PM Eastern daily and stays closed weekends and holidays. When it reopens, prices gap sharply. If you borrow USDC against your tokenized stock and the market opens against you over a weekend, your collateral value drops so fast that you hit the liquidation line before you wake up. That's the danger Tessera solves."
          },
          {
            "type": "h3",
            "text": "How It Works: Two Sides"
          },
          {
            "type": "p",
            "text": "Tessera has two complementary sides: a lend side where you earn yield on USDC, and a borrow side where you unlock liquidity against tokenized-stock collateral."
          },
          {
            "type": "h3",
            "text": "Lend Side (Earn Yield)"
          },
          {
            "type": "p",
            "text": "You supply USDC into the protocol vault. That USDC is lent to borrowers who post tokenized stock as collateral. As borrowers pay interest on loans, you earn that yield. The more demand to borrow, the higher your yield. You can withdraw your USDC plus accrued interest anytime liquidity allows."
          },
          {
            "type": "h3",
            "text": "Borrow Side (Unlock Liquidity)"
          },
          {
            "type": "p",
            "text": "You deposit tokenized stock (tAAPL, tTSLA, or tSPY) as collateral and borrow USDC against it. How much you can borrow depends on your collateral's risk-adjusted value, expressed as a Loan-to-Value (LTV) ratio. For tAAPL, the max LTV is 50%, meaning you can borrow 0.50 USDC for every 1.00 of tAAPL. That conservative limit exists because tokenized stocks gap overnight."
          },
          {
            "type": "h3",
            "text": "The Watcher: Your Liquidation Shield"
          },
          {
            "type": "p",
            "text": "The Watcher is an autonomous AI agent running 24/7. It watches your position's health factor every 10 seconds. If your health factor starts to slip, especially during off-hours, it takes three actions: (1) sends you a plain-English alert; (2) if pre-approved, it auto-repays your debt to push you back to safety; (3) if that's not enough, a permissionless backstop liquidates only as a last resort."
          },
          {
            "type": "h3",
            "text": "Conservative Risk Parameters"
          },
          {
            "type": "p",
            "text": "The protocol is built on defensive assumptions about overnight and weekend gaps."
          },
          {
            "type": "table",
            "headers": [
              "Asset",
              "Max LTV",
              "Liquidation Threshold"
            ],
            "rows": [
              [
                "tAAPL",
                "50%",
                "65%"
              ],
              [
                "tTSLA",
                "40%",
                "55%"
              ],
              [
                "tSPY",
                "60%",
                "75%"
              ]
            ]
          },
          {
            "type": "p",
            "text": "Max LTV is the maximum loan-to-value ratio. Liquidation Threshold is where your position becomes liquidatable. The gaps buffer overnight volatility."
          },
          {
            "type": "h3",
            "text": "No Token Ever"
          },
          {
            "type": "p",
            "text": "Tessera will never launch a token. The protocol earns revenue through a 15% reserve factor on borrow interest, a transparent share of what borrowers pay. That reserve is first-loss capital. It aligns the protocol's incentives with safety, not coin sales."
          }
        ]
      },
      {
        "title": "How to Lend",
        "slug": "how-to-lend",
        "blocks": [
          {
            "type": "p",
            "text": "Lending is how you earn yield on USDC without custody risk. You supply USDC to the protocol vault; borrowers borrow it against their tokenized-stock collateral and pay interest; you receive that interest as yield, compounded daily."
          },
          {
            "type": "h3",
            "text": "Step 1: Supply USDC"
          },
          {
            "type": "p",
            "text": "Navigate to the Earn section of the Tessera app. Enter the amount of USDC you want to supply. Approve the vault to spend your USDC. Click Supply. Your USDC is now in the vault."
          },
          {
            "type": "h3",
            "text": "What Happens to Your USDC"
          },
          {
            "type": "p",
            "text": "You receive lending shares, a claim on a growing USDC pool. As borrowers repay loans plus interest, each share's value increases. You don't actively manage anything; interest accrues passively. Your dashboard shows your balance and yield earned."
          },
          {
            "type": "h3",
            "text": "Your Yield Rate"
          },
          {
            "type": "p",
            "text": "The yield you earn is determined by supply APY, which varies based on how much of the USDC pool is currently borrowed. Higher utilization means higher yield. Lower utilization means lower yield. This incentivizes lending when demand is high."
          },
          {
            "type": "p",
            "text": "The protocol charges borrowers a 15% reserve factor on interest payments, a cut going into the protocol reserve for safety. This does not affect your yield."
          },
          {
            "type": "h3",
            "text": "Step 2: Withdraw Your USDC"
          },
          {
            "type": "p",
            "text": "At any time, go to the Earn section and click Withdraw. You'll receive your original USDC plus all accrued interest. Withdrawal is instant if liquidity is available."
          },
          {
            "type": "h3",
            "text": "Key Points"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "No minimum supply, but 100 USDC total debt in the system keeps dust off the books.",
              "Your USDC earns yield every block. Check your dashboard.",
              "Withdraw anytime liquidity permits. No lock-up period.",
              "Interest is paid by borrowers; you don't pay fees to lend.",
              "On testnet, no insurance. Risks include smart-contract flaws, oracle failures, and cascade."
            ]
          }
        ]
      },
      {
        "title": "How to Borrow",
        "slug": "how-to-borrow",
        "blocks": [
          {
            "type": "p",
            "text": "Borrowing lets you unlock liquidity without selling your tokenized stocks. Post your tAAPL, tTSLA, or tSPY as collateral, borrow USDC, and repay with interest whenever you choose."
          },
          {
            "type": "h3",
            "text": "Step 1: Deposit Collateral"
          },
          {
            "type": "p",
            "text": "Navigate to the Borrow section. Select the tokenized stock you want to use as collateral. Enter the amount. Approve the vault to transfer your tokens. Click Deposit. Your tokenized stock is now held in the vault."
          },
          {
            "type": "h3",
            "text": "Step 2: Determine Your Borrow Capacity"
          },
          {
            "type": "p",
            "text": "Your borrow capacity is calculated as: Borrow Capacity = Collateral Value times Max LTV."
          },
          {
            "type": "p",
            "text": "For example, if you deposit 10,000 USD of tAAPL (max LTV 50%), your borrow capacity is 5,000 USDC. The collateral value is determined by the on-chain price feed (testnet mock on chain 46630; licensed real feed at mainnet). The Max LTV is set conservatively for overnight/weekend gaps."
          },
          {
            "type": "h3",
            "text": "Step 3: Borrow USDC"
          },
          {
            "type": "p",
            "text": "In the Borrow section, enter the amount of USDC you want to borrow (up to your capacity). Click Borrow. You receive the USDC instantly. The vault begins accruing interest on your debt."
          },
          {
            "type": "h3",
            "text": "Your Interest Rate"
          },
          {
            "type": "p",
            "text": "Your borrow interest rate is determined by the borrow APR, which varies based on how much of the lenders' USDC pool is in use. Low utilization (less than 80%) means slower interest growth; high utilization (greater than 80%) means steep growth. The maximum borrow rate is capped at 300% APR."
          },
          {
            "type": "h3",
            "text": "Step 4: Repay Your Debt"
          },
          {
            "type": "p",
            "text": "At any time, go to the Borrow section and enter the amount of USDC you want to repay (including accrued interest). Your debt decreases, and you move further from the liquidation line. You can repay all at once or in increments."
          },
          {
            "type": "h3",
            "text": "Step 5: Withdraw Your Collateral"
          },
          {
            "type": "p",
            "text": "Once you've fully repaid your debt, you can withdraw your tokenized stock. Go to the Borrow section and click Withdraw Collateral. You receive your tAAPL, tTSLA, or tSPY back, free and clear."
          },
          {
            "type": "h3",
            "text": "Key Points"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Minimum borrow: 100 USDC per loan. No maximum beyond collateral capacity.",
              "Interest accrues every block. Check your dashboard for real-time debt.",
              "You can repay or borrow more anytime your health factor allows.",
              "Your collateral is locked while you have debt. You cannot withdraw until repaid.",
              "The Watcher monitors 24/7. If your HF drops toward liquidation, it will attempt auto-repay (if approved) or liquidate (if necessary)."
            ]
          }
        ]
      },
      {
        "title": "Health Factor",
        "slug": "health-factor",
        "blocks": [
          {
            "type": "p",
            "text": "Your health factor is a single number that tells you how close you are to liquidation. It's the core metric to watch if you borrow. Understand it, and you understand the risk."
          },
          {
            "type": "h3",
            "text": "The Definition"
          },
          {
            "type": "p",
            "text": "Health Factor = (Total Collateral Value times Liquidation Threshold) divided by Total Debt."
          },
          {
            "type": "p",
            "text": "Your collateral value is the USD value of your deposited tokenized stocks from the on-chain oracle. Your liquidation threshold is the asset-specific percentage: 65% for tAAPL, 55% for tTSLA, 75% for tSPY. Your total debt is the USDC you've borrowed plus all accrued interest."
          },
          {
            "type": "h3",
            "text": "What the Numbers Mean"
          },
          {
            "type": "p",
            "text": "Think of your health factor as a safety cushion:"
          },
          {
            "type": "table",
            "headers": [
              "Health Factor",
              "Status",
              "What It Means"
            ],
            "rows": [
              [
                "Greater than 2.0",
                "Safe",
                "You have a 2x cushion. You can borrow more."
              ],
              [
                "1.5 to 2.0",
                "Comfortable",
                "You have a solid buffer. Using leverage safely."
              ],
              [
                "1.2 to 1.5",
                "Caution",
                "Reasonable buffer. A moderate overnight gap could threaten you."
              ],
              [
                "1.0 to 1.2",
                "Danger",
                "Close to liquidation. A small adverse price move liquidates you."
              ],
              [
                "Less than 1.0",
                "Liquidatable",
                "You are being liquidated now."
              ]
            ]
          },
          {
            "type": "h3",
            "text": "An Example"
          },
          {
            "type": "p",
            "text": "Say you deposit 10,000 USD of tAAPL (threshold 65%) and borrow 5,000 USDC. Your HF = (10,000 times 0.65) divided by 5,000 = 6,500 divided by 5,000 = 1.3. You're safe. If tAAPL drops 20% overnight to 8,000 USD, your HF = (8,000 times 0.65) divided by 5,000 = 5,200 divided by 5,000 = 1.04. You're at the edge. A further 2-3% drop liquidates you."
          },
          {
            "type": "h3",
            "text": "The Liquidation Line"
          },
          {
            "type": "p",
            "text": "A health factor of exactly 1.0 is the liquidation line. At HF = 1.0, your collateral value at threshold equals your debt. You are unsafe."
          },
          {
            "type": "p",
            "text": "When liquidated: A liquidator seizes up to 50% of your collateral (close factor) and sells it to repay your debt. The liquidator receives a bonus (5% base, ramping to 15% if very underwater). If your HF is below 0.95, your entire position is liquidatable."
          },
          {
            "type": "h3",
            "text": "How the Watcher Protects You"
          },
          {
            "type": "p",
            "text": "The Watcher checks your health factor every 10 seconds, 24/7. If it sees your HF approaching 1.0, especially during nights, weekends, or holidays when prices can gap, it takes action:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Alerts: You get a plain-English message about your risk level.",
              "Auto-repay (if approved): If you've given the Watcher an allowance and have idle USDC, it automatically repays part of your debt.",
              "Backstop: If your HF drops to critical levels and the Watcher can't auto-repay enough, a permissionless liquidation occurs as a last resort."
            ]
          },
          {
            "type": "h3",
            "text": "How to Stay Safe"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Keep a safety margin. Aim for a health factor of 1.3 to 1.5. Don't borrow right up to capacity.",
              "Diversify collateral. Use multiple assets (tAAPL, tTSLA, tSPY) to stabilize. Single-asset concentration is risky.",
              "Monitor during off-hours. Set alerts if your HF approaches 1.2 at night or weekends. Proactively repay before market close.",
              "Use the Watcher's allowance. Pre-approve it to auto-repay with a cap (e.g., 5,000 USD per day). This dramatically improves resilience.",
              "Understand what you're borrowing for. If trading, liquidation risk is explicit. If borrowing for utility, it may not be worth the gap risk."
            ]
          },
          {
            "type": "h3",
            "text": "The Fine Print: Risk Factors"
          },
          {
            "type": "p",
            "text": "Your health factor can deteriorate from two sources: Collateral price drop (if your tokenized stock falls in USD value, your collateral shrinks and your HF drops); Debt growth (as you accrue interest, your total debt grows and your HF drifts downward). Both happen on testnet. On mainnet, the oracle will be a real dual-feed with deviation guards; today it's a testnet mock. Interest accrual is deterministic and visible on your dashboard."
          }
        ]
      }
    ]
  },
  {
    "title": "The AI",
    "sections": [
      {
        "title": "The Watcher",
        "slug": "the-watcher",
        "blocks": [
          {
            "type": "h2",
            "text": "The Watcher"
          },
          {
            "type": "p",
            "text": "Tessera includes an autonomous AI agent that monitors every borrower's position around the clock. This document explains exactly what it does, what it does not do, what happens if it goes down, and how you control it."
          },
          {
            "type": "h3",
            "text": "What the Watcher does"
          },
          {
            "type": "p",
            "text": "The Watcher executes three core functions: (1) **Monitors health factor continuously** — checking every borrower's position approximately every 10 seconds. (2) **Sends plain-English alerts** before liquidation risk peaks — human-readable warnings appear in the app. (3) **Triggers liquidation when required** — immediately submits a transaction if health factor falls below 1.0."
          },
          {
            "type": "h3",
            "text": "The deterministic core vs. the LLM"
          },
          {
            "type": "p",
            "text": "A critical design choice: the Watcher's financial decisions are 100% deterministic. A rules engine reads health factor and decides whether to trigger protection. The LLM is used only to generate human-readable copies of those decisions and to parse your natural-language config changes into structured parameters. An LLM deciding whether to move money is unpredictable and unauditable. A deterministic core is reproducible, testable, and verifiable. The Watcher's protective logic is code you can read; its explanations are AI-written, but the facts are always mechanical and transparent."
          },
          {
            "type": "h3",
            "text": "What the Watcher does NOT do"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Does not custody your funds — it can only reduce your debt using an allowance you set and can revoke",
              "Does not guarantee protection — a severe overnight gap in stock prices can liquidate even while watching",
              "Cannot protect across all market conditions — extreme 30% single-block gaps can cross the liquidation line faster than any on-chain reaction",
              "Does not make yield decisions — it monitors risk only"
            ]
          },
          {
            "type": "h3",
            "text": "The kill switch"
          },
          {
            "type": "p",
            "text": "You control the Watcher completely. A single action stops it instantly: **revoke the USDC allowance** from the Watcher to the vault. Once your allowance is zero, the Watcher can no longer repay on your behalf. This single action is both the spending boundary and the kill switch combined."
          },
          {
            "type": "p",
            "text": "Additionally, the protocol owner holds an on-chain admin fail-safe: the owner can pause all state-mutating functions at any time (pausing does not block repayment or liquidation, only new borrows and withdrawals). This is a last-resort circuit breaker if the Watcher or its key is compromised."
          },
          {
            "type": "h3",
            "text": "If the Watcher goes down"
          },
          {
            "type": "p",
            "text": "The Watcher is a service that may experience downtime — a crashed process, network outage, or RPC latency. On testnet, if the Watcher is silent for more than 15 minutes and a position needs liquidation, a **permissionless backstop opens**: anyone can call `liquidate()` with identical economic guarantees (5% bonus, 50% close factor) that the Watcher would use."
          },
          {
            "type": "p",
            "text": "How this works: The Watcher stamps an on-chain heartbeat when it acts (the vault records the timestamp). If that heartbeat is older than 15 minutes (testnet; configurable at mainnet), the protocol permits permissionless liquidation using the same math. The backstop is not a weaker fallback — it is as fair as agent liquidation. If the Watcher is down 30 minutes and an underwater position exists, a permissionless liquidator can step in. The position is protected by the same on-chain math. Tessera remains safe even if the agent process fails."
          },
          {
            "type": "h3",
            "text": "Monitoring the Watcher"
          },
          {
            "type": "p",
            "text": "From the app, navigate to the **Agent** page to see: (1) **Action log** — the last 50 actions, newest first. (2) **Health status** — is it running, when it last checked, any errors. (3) **Current alerts** — positions with health factor below 1.1e18, color-coded by urgency."
          },
          {
            "type": "p",
            "text": "Developers can call the agent's HTTP API directly: `GET /health` for liveness, `GET /actions?limit=50` for recent actions, `GET /alerts/latest` for open alerts, `GET /metrics` for Prometheus metrics."
          }
        ]
      },
      {
        "title": "Active Protection",
        "slug": "active-protection",
        "blocks": [
          {
            "type": "h2",
            "text": "Active Protection"
          },
          {
            "type": "p",
            "text": "Tessera's most powerful feature: the Watcher can repay your debt before liquidation happens, restoring your health and protecting you from the liquidation penalty. This is opt-in and entirely under your control."
          },
          {
            "type": "h3",
            "text": "What is active protection?"
          },
          {
            "type": "p",
            "text": "Active protection allows the Watcher to automatically repay part of your debt from your own pre-approved USDC when your position approaches danger. When health factor approaches 1.1, the Watcher calculates how much USDC repayment would restore your health to a safe level (typically 1.2 or higher). If you have opted in and have sufficient USDC pre-approved, the Watcher repays that amount on your behalf, your debt decreases, liquidation is avoided, and the action is logged in your history."
          },
          {
            "type": "p",
            "text": "**Key distinction**: the Watcher repays from your own USDC, not from any protocol reserve or third party. You choose how much to approve, and you can revoke the approval at any time."
          },
          {
            "type": "h3",
            "text": "How to enable active protection"
          },
          {
            "type": "list",
            "ordered": true,
            "items": [
              "In your wallet, approve the Tessera vault to spend USDC on your behalf. The amount you approve is the ceiling the Watcher cannot exceed.",
              "Set an allowance amount via a simple slider or input, typically between 1,000 USDC and 100,000 USDC depending on your position size."
            ]
          },
          {
            "type": "p",
            "text": "Once approved, the Watcher begins monitoring. The next time your health factor falls near the threshold, repayment triggers automatically."
          },
          {
            "type": "h3",
            "text": "On-chain caps (safety guardrails)"
          },
          {
            "type": "p",
            "text": "Even if the Watcher's code or private key is compromised, you are protected by two hard limits written directly into the vault contract:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "**Per-transaction cap**: 10,000 USDC/user/tx. A single repayment cannot exceed this, even if your allowance is higher.",
              "**Per-day cap**: 25,000 USDC/user/day. Across all repayments in a calendar day, the Watcher cannot repay more than 25,000 USDC per user. Daily resets at UTC midnight."
            ]
          },
          {
            "type": "p",
            "text": "These caps are **on-chain enforced**. The vault contract contains this logic. Even if the agent's code is buggy or its key is compromised, the on-chain ceilings prevent excessive repayment. A compromised agent KEY cannot bypass these limits."
          },
          {
            "type": "h3",
            "text": "How to disable active protection"
          },
          {
            "type": "p",
            "text": "Active protection is opt-in and easily disabled: (1) **Set allowance to zero** — in your wallet, revoke the USDC allowance to the Tessera vault. The Watcher will immediately have no spending power. (2) Or **approve a smaller amount** if you want to keep some protection but with a tighter cap."
          },
          {
            "type": "p",
            "text": "The Watcher checks your allowance on every tick (~10 seconds). A zero allowance disables protection instantly."
          },
          {
            "type": "h3",
            "text": "Why your allowance is the kill switch"
          },
          {
            "type": "p",
            "text": "The Watcher's repayment power is entirely bounded by your ERC-20 allowance. This design means: (1) **You control the ceiling** — you decide the maximum USDC the Watcher can access, with on-chain per-transaction and daily caps as additional guardrails. (2) **The Watcher cannot extract value** — it cannot repay more than your allowance, cannot repay another user's debt, cannot move any other asset. (3) **Revocation is instantaneous** — setting your allowance to zero takes effect on the next block. (4) **Your balance is a second boundary** — even if you approve 100,000 USDC, if you only hold 5,000, the Watcher can access at most 5,000."
          },
          {
            "type": "h3",
            "text": "The honest limit: active protection does not guarantee safety"
          },
          {
            "type": "p",
            "text": "If a tokenized stock drops 30% overnight (an extreme but possible scenario), your health factor can cross the liquidation line faster than any on-chain repayment can execute. Active protection reduces the *likelihood* of liquidation by handling small gaps and volatility; it does not guarantee protection against catastrophic price moves. **Do not borrow at the edge of your health factor.** Borrow conservatively. The Watcher is a risk layer, not insurance."
          },
          {
            "type": "h3",
            "text": "How repayment is deterministically triggered"
          },
          {
            "type": "p",
            "text": "The Watcher's decision to repay is based on four deterministic regimes: (1) **Regime 0 (Safe)** — health factor > 1.2, no action. (2) **Regime 1 (Caution)** — health factor 1.1–1.2, alerts sent. (3) **Regime 2 (Danger)** — health factor 1.0–1.1, auto-repay initiated. (4) **Regime 3 (Liquidating)** — health factor < 1.0, liquidation or permissionless backstop."
          },
          {
            "type": "p",
            "text": "When in Regime 2, the Watcher: (1) Calculates the USDC repay amount needed to restore health to Regime 0 (safe). (2) Checks your allowance and balance. (3) Applies the per-transaction and per-day caps. (4) Simulates the repayment via `eth_call` to ensure it will succeed. (5) If all checks pass, submits the transaction. Every step is transparent and logged in your action history."
          },
          {
            "type": "h3",
            "text": "Cost of active protection"
          },
          {
            "type": "p",
            "text": "There is no separate fee. You pay: (1) **Transaction gas** — the Watcher pays gas from its own float. You do not reimburse it. (2) **Interest on the repaid amount** — when the Watcher repays 5,000 USDC of your debt, your remaining debt is smaller, so interest owed decreases immediately."
          },
          {
            "type": "p",
            "text": "Active protection is economically beneficial: it saves you the 5% liquidation penalty and any additional losses from a forced liquidation."
          },
          {
            "type": "h3",
            "text": "Monitoring your protection status"
          },
          {
            "type": "p",
            "text": "From the **Borrow** page, you can see: (1) Your current health factor and regime (Safe/Caution/Danger/Liquidating). (2) Your USDC allowance to the vault (the protection budget). (3) The auto-repay utilization today (how much of your daily 25,000 USDC cap is used)."
          },
          {
            "type": "p",
            "text": "The **Agent** page shows: (1) A log of every auto-repay event with amount repaid, health factor before and after, and reasons for skipping. (2) Open alerts for your position (if health factor < 1.1)."
          }
        ]
      }
    ]
  },
  {
    "title": "Risk & safety",
    "sections": [
      {
        "title": "Risks",
        "slug": "risks",
        "blocks": [
          {
            "type": "p",
            "text": "Tessera lets you borrow USDC against tokenized stocks. Like any borrowing protocol, this comes with real risks. We list them plainly below — not to scare you, but so you can make an informed choice about whether Tessera is right for you."
          },
          {
            "type": "h3",
            "text": "Gap risk: the core problem we exist to solve"
          },
          {
            "type": "p",
            "text": "Tokenized stocks on Robinhood Chain trade 24/7. The underlying US equity market does not — it closes at 4pm ET Friday through 9:30am ET Monday, plus overnight. When the market reopens, a stock's price can jump sharply if there was news, earnings, or a geopolitical event over the weekend. If you've borrowed against that stock, your position can jump underwater overnight, and you may get liquidated before you wake up."
          },
          {
            "type": "p",
            "text": "This is the structural problem Tessera exists to solve. Our AI agent (the Watcher) watches your health factor around the clock and can auto-repay on your behalf (if you opt in) or alert you before liquidation happens. But understand: a severe enough gap can still liquidate you, even with the agent running. The agent is a risk layer, not an insurance policy."
          },
          {
            "type": "p",
            "text": "Our risk parameters (max LTV 40–60%, liquidation thresholds 55–75%) are conservative precisely because of this risk. They give you room to absorb a gap without immediate liquidation."
          },
          {
            "type": "h3",
            "text": "Agent downtime or malfunction"
          },
          {
            "type": "p",
            "text": "The Watcher is a TypeScript agent running on a host process. It monitors your health via RPC calls and can execute liquidations and repayments on-chain. If the agent goes down or fails to check your position, you lose the real-time protection it provides; your position is no longer watched every 10 seconds. You can still repay manually via the dashboard or by calling repay() directly. If your health factor drops below 1.0 and the agent is down, anyone can liquidate you (once the permissionless backstop is enabled at mainnet; on testnet, only the agent can liquidate)."
          },
          {
            "type": "p",
            "text": "On testnet, the agent has a heartbeat-gated permissionless backstop built and tested: if the agent goes silent for more than 15 minutes, the vault enters a mode where any address can liquidate stale-heartbeat positions at a bounty. This backstop is proven to work on-chain but is not yet enabled (it will be at mainnet after independent audit). Until then, testnet users rely on the agent staying online."
          },
          {
            "type": "h3",
            "text": "Smart-contract risk"
          },
          {
            "type": "p",
            "text": "Tessera's vault contract is written in Rust (Arbitrum Stylus) and the oracle router (PriceGuard) is Solidity. Both are testnet software and have not been audited by a third party. Real bugs — reentrancy, arithmetic overflow, access-control errors — are possible and could lead to loss of funds."
          },
          {
            "type": "p",
            "text": "**Tessera is pre-audit testnet software. Do not deposit funds you cannot afford to lose. Independent audit is a hard requirement before any mainnet deployment.** The vault uses conservative math: multiplication before division, saturating arithmetic where overflow could matter, and unit tests covering the health-factor and liquidation math. The code is open-source and has been through internal review. But testnet is testnet — real security review by professional auditors will happen before mainnet."
          },
          {
            "type": "h3",
            "text": "Oracle risk"
          },
          {
            "type": "p",
            "text": "Tessera reads prices through the PriceGuard oracle router, which pulls from Chainlink (or a mock on testnet). If the oracle is wrong, so are your health factor and liquidation price."
          },
          {
            "type": "p",
            "text": "On testnet today, we use a mock oracle — an owner-controlled price feed for testing. This is not a real Chainlink feed; it's a stand-in so we can demo and test without depending on Chainlink's RH Chain infrastructure (which doesn't exist yet). A real Chainlink oracle is a mainnet gate."
          },
          {
            "type": "p",
            "text": "Risks in the oracle path: (1) **Staleness**: If the price feed stops updating (network outage, Chainlink node down), the vault's prices are stale and may not reflect reality. PriceGuard has a staleness check that reverts borrow() and liquidate() if the feed is too old; but stale prices that are within the freshness window will still be used. (2) **Deviation**: If a secondary oracle deviates sharply from the primary, PriceGuard halts new risk (borrow/withdraw) to be safe, but existing liquidations may proceed. (3) **Market-hours haircut**: When the underlying market is closed (weekends, holidays), new borrows are haircut (reduced LTV) to account for the higher gap risk. But the price itself is still read from the last trade; if the market gaps hard at open, that position is still at risk."
          },
          {
            "type": "h3",
            "text": "Liquidation risk and bad debt"
          },
          {
            "type": "p",
            "text": "If your health factor falls below 1.0, your position can be liquidated. The liquidator repays some of your USDC debt and receives collateral plus a 5% base bonus (which ramps with depth if you're very underwater). With a 50% close factor, a liquidator can repay up to 50% of your debt in one transaction."
          },
          {
            "type": "p",
            "text": "Liquidation is not always enough to clear your debt — if your collateral runs out before the debt is repaid, you have bad debt. In that case, the protocol marks the loss (you owe USDC you don't have), and the lenders on the supply side bear the loss. On testnet, the reserve factor (15% of borrow interest) is the first-loss buffer; at mainnet, we'll have insurance / additional safeguards."
          },
          {
            "type": "h3",
            "text": "Off-hours execution risk"
          },
          {
            "type": "p",
            "text": "Markets close, but the blockchain does not. When the US equity market is closed (nights, weekends, holidays), Robinhood Chain still accepts transactions. If you or the agent tries to borrow or liquidate during off-hours: (1) New borrows are haircut (e.g., a collateral that normally supports 60% LTV is reduced to 51% LTV). This prices in the gap risk. You can still borrow, just less. (2) Liquidations can still proceed at any time (the agent might liquidate your position at 2am to protect you). (3) Prices are read from the last trade during market hours. If a stock gaps hard at market open, that price won't be known on-chain until the oracle updates — which could leave you underwater at an old price."
          },
          {
            "type": "h3",
            "text": "Lender risks (USDC supply side)"
          },
          {
            "type": "p",
            "text": "If you supply USDC to Tessera to earn lending yield: You earn interest from borrowers, but you're exposed to bad debt. If borrowers get liquidated but collateral doesn't cover the debt, lenders absorb the loss. The protocol's 15% reserve factor is your first-loss cushion; beyond that, lender losses are real. On testnet, there is no insurance or safety net. Mainnet will require insurance and additional safeguards."
          },
          {
            "type": "h3",
            "text": "Testnet-only risks"
          },
          {
            "type": "p",
            "text": "**Tessera is live on Robinhood Chain testnet (chain 46630) only. No real assets can be used; all tokens are test mocks. The entire system may be reset or shut down. Do not treat testnet money as real.** The RPC endpoint may be unstable or disappear. Testnet tokens have no real value. The vault contract may be redeployed, which would reset all balances. The mock price oracle is owned by the operator and can be updated instantly for testing."
          },
          {
            "type": "h3",
            "text": "What we do to mitigate these risks"
          },
          {
            "type": "list",
            "ordered": true,
            "items": [
              "Conservative LTVs: tAAPL max 50%, tTSLA 40%, tSPY 60%. These give you room to absorb volatility.",
              "The Watcher: Monitors your health ~every 10 seconds and can auto-repay (with your pre-approval) before liquidation happens.",
              "Dual-feed oracle routing (PriceGuard): Primary and secondary oracle feeds with deviation checks. If secondary deviates sharply, we halt new risk.",
              "Staleness protection: borrow() and liquidate() revert if the price is older than the freshness window.",
              "Market-hours haircut: Off-hours borrows are haircut to account for gap risk.",
              "Permissionless backstop: Built and tested. If the agent goes silent, anyone can liquidate stale positions at a bounty, so lenders are not stranded.",
              "Open-source code: You can read everything. Bugs have nowhere to hide.",
              "Transparent parameters: All risk numbers (LTV, thresholds, reserve factor, agent caps) are public and on-chain."
            ]
          }
        ]
      },
      {
        "title": "Oracle & pricing",
        "slug": "oracle-pricing",
        "blocks": [
          {
            "type": "p",
            "text": "Tessera reads prices for all collateral (tAAPL, tTSLA, tSPY) and the debt asset (USDC) through a dedicated oracle router contract called PriceGuard. This separation of concerns — prices are managed in their own contract, not in the vault — means oracle policy can evolve without ever touching the vault's funds-holding code."
          },
          {
            "type": "h3",
            "text": "How prices are read"
          },
          {
            "type": "p",
            "text": "When you borrow or liquidate, the vault calls PriceGuard.getPrice(token), which returns an 8-decimal USD price (Chainlink convention: 1e8 = $1.00). PriceGuard internally: (1) Reads the primary oracle feed (e.g., Chainlink's AAPL / USD feed on mainnet). (2) Optionally checks a secondary feed and halts if they deviate too sharply. (3) Validates that the price is not stale (within a freshness window, e.g., < 15 minutes old). (4) If the market is closed (weekend / holiday), notes this state so the vault can haircut new borrows. (5) Returns the price, or reverts if any check fails."
          },
          {
            "type": "p",
            "text": "This design is conservative: the vault does not have to know about freshness, deviation, or market hours. It just asks PriceGuard for a price; if the price isn't defensible, it doesn't get one."
          },
          {
            "type": "h3",
            "text": "Staleness: fails closed"
          },
          {
            "type": "p",
            "text": "If a price feed hasn't updated in too long (default: 15 minutes on testnet), PriceGuard considers it stale and reverts. This happens in the vault's borrow() and liquidate() calls — they will not execute if the price is stale."
          },
          {
            "type": "p",
            "text": "Why fail closed? Because a stale price is worse than no action. If you could borrow at a stale price, you might borrow too much and not realize it. If you could liquidate at a stale price, you might liquidate in the wrong direction. Failing closed (reverting the transaction) forces the oracle to update or the action to wait."
          },
          {
            "type": "p",
            "text": "Note: reading your health factor via the Lens (a read-only oracle wrapper) does not fail closed; it returns the best price it can. This is intentional — you should always be able to check your health, even if the oracle is slightly stale. But state-changing actions (borrow, liquidate) require a fresh price."
          },
          {
            "type": "h3",
            "text": "Testnet mock oracle"
          },
          {
            "type": "p",
            "text": "On Robinhood Chain testnet (chain 46630), Tessera uses a mock oracle for tAAPL, tTSLA, and tSPY. This is a simple ERC-20-style price feed that the operator can update. It is not a real Chainlink feed."
          },
          {
            "type": "p",
            "text": "Why a mock? Chainlink oracle infrastructure for Robinhood Chain does not yet exist (the chain itself is testnet). We use a mock so we can test the full stack without waiting for Chainlink's infrastructure team. At mainnet, we will deploy a real Chainlink oracle or an equivalent licensed feed."
          },
          {
            "type": "p",
            "text": "**The testnet oracle can be updated by the operator in seconds. Prices are not validated against real-world data. This is fit-for-testing, not fit-for-production. At mainnet, a real oracle (Chainlink or equivalent) is a non-negotiable gate.**"
          },
          {
            "type": "h3",
            "text": "Market-closed haircut"
          },
          {
            "type": "p",
            "text": "When the US equity market is closed (nights, weekends, holidays), the PriceGuard sets a market_closed flag. The vault reads this flag and applies a haircut to new borrows."
          },
          {
            "type": "p",
            "text": "Example: tAAPL normally supports 50% LTV. When the market closes at 4pm ET Friday, new borrows are haircut to 42.5% LTV (85% of 50%). This prices in the overnight/weekend gap risk — you can still borrow, but you're borrowing less against the same collateral."
          },
          {
            "type": "p",
            "text": "The haircut is applied only to new borrows; existing loans are not affected. The price itself is still the last trade price from market close, not a predicted Monday open. So if a stock gaps hard at Monday open, your position can still be underwater at the old price."
          },
          {
            "type": "h3",
            "text": "Dual-feed deviation check"
          },
          {
            "type": "p",
            "text": "On mainnet, PriceGuard can be configured with a secondary oracle feed as a sanity check. If the secondary feed deviates sharply from the primary (e.g., > 5% difference), PriceGuard sets a halted flag."
          },
          {
            "type": "p",
            "text": "When halted is true, the vault blocks new risk (borrow and withdraw operations), but allows debt reduction (repay and liquidate). This protects lenders: if the oracle is acting weird, we stop new borrowing but let existing debt be repaid and underwater positions be liquidated."
          },
          {
            "type": "h3",
            "text": "Price precision"
          },
          {
            "type": "p",
            "text": "All prices are 8-decimal USD (Chainlink standard). Collateral tokens (tAAPL, tTSLA, tSPY) are 18 decimals; USDC is 6 decimals. The interest-model and liquidation math handles the decimals correctly, so you don't have to think about it — the numbers just work."
          },
          {
            "type": "h3",
            "text": "Frequency of price updates"
          },
          {
            "type": "p",
            "text": "The vault does not poll prices. Prices are read on demand whenever you execute an action (borrow, repay, liquidate, lend, withdraw). Between actions, the last price on the oracle is the current price — it may be stale if the market just moved."
          },
          {
            "type": "p",
            "text": "The agent (the Watcher) reads prices ~every 10 seconds via RPC to check your health and decide whether to liquidate or repay. But the on-chain prices are only snapshotted when you submit a transaction."
          }
        ]
      },
      {
        "title": "Liquidation & the backstop",
        "slug": "liquidation-backstop",
        "blocks": [
          {
            "type": "p",
            "text": "When your health factor drops below 1.0, your position is underwater and can be liquidated. A liquidator repays some of your debt and receives collateral plus a bonus. This section explains how liquidation works and what happens if the agent goes down."
          },
          {
            "type": "h3",
            "text": "How liquidation works"
          },
          {
            "type": "p",
            "text": "Liquidation is a partial process by default. The liquidator specifies how much USDC they want to repay on your behalf; the vault calculates how much collateral they receive as a result."
          },
          {
            "type": "p",
            "text": "The formula: max_repay = your_debt × close_factor ÷ 100%; actual_repay = min(requested, max_repay); seize_value = actual_repay × (1 + bonus%); seize_collateral = seize_value ÷ collateral_price"
          },
          {
            "type": "p",
            "text": "With a 50% close factor and 5% base liquidation bonus: If you owe $1,200 USDC, a liquidator can repay at most $600 (50% of debt). If they repay $600, they receive $630 worth of collateral ($600 × 1.05). After liquidation, you still owe $600; your position is healthier but not closed. Full liquidation happens automatically if your health factor falls below 0.95: anyone can repay your entire debt at once."
          },
          {
            "type": "h3",
            "text": "Liquidation bonus"
          },
          {
            "type": "p",
            "text": "The base liquidation bonus is 5%: the liquidator receives 5% more collateral value than the USDC they repay. This incentivizes liquidators to step in and keep the protocol solvent."
          },
          {
            "type": "p",
            "text": "The bonus ramps with depth. If you're very underwater (health factor near zero), the bonus climbs toward a higher maximum (e.g., 15%) to incentivize liquidators to clear bad debt. The deeper you are, the more attractive liquidation becomes. This is a Dutch auction mechanism: if you're slightly underwater, liquidators have a small bonus and won't rush; if you're severely underwater, the bonus is juicy and someone will move fast."
          },
          {
            "type": "h3",
            "text": "On testnet: agent-only liquidation"
          },
          {
            "type": "p",
            "text": "Today on testnet, only the Watcher agent can call the vault's liquidate() function. This is because the permissionless backstop (see below) is not yet enabled. If you get liquidated, it's the agent that does it — watching your position and acting to protect you (and the lenders) before you get too underwater."
          },
          {
            "type": "h3",
            "text": "The permissionless backstop (testnet-proven, mainnet-ready)"
          },
          {
            "type": "p",
            "text": "When the agent goes down or goes silent, lenders are at risk: underwater positions may not get liquidated, and bad debt can accumulate. The permissionless backstop solves this."
          },
          {
            "type": "p",
            "text": "Here's how it works: (1) The agent stamps an on-chain heartbeat every few seconds by calling vault.heartbeat(). This records the timestamp of the last time the agent checked in. (2) If the agent is down, the heartbeat stops updating. After a delay (15 minutes on testnet), the heartbeat is considered stale. (3) Once the heartbeat is stale, any address can call liquidate() and clear underwater positions. The backstop is now open. (4) Any position liquidated via the backstop is marked with a backstop_liquidation event, and a different (higher) liquidation bonus may apply to incentivize the backstop liquidator."
          },
          {
            "type": "p",
            "text": "This design protects lenders: even if the agent crashes and never recovers, liquidations will still happen (just with a delay). The backstop does not kick in immediately — it waits for the heartbeat to truly stale — so a momentarily-idle agent does not trigger false liquidations."
          },
          {
            "type": "p",
            "text": "**The permissionless backstop has been implemented, tested, and proven on an earlier testnet deployment: a non-agent address liquidated a stale-heartbeat position on-chain, raising health from 0.94 to 1.20. It works. On the current testnet (Robinhood Chain), it is not yet enabled (the delay is set to 0). It will be enabled at mainnet after independent audit.**"
          },
          {
            "type": "h3",
            "text": "Bad debt"
          },
          {
            "type": "p",
            "text": "If a position gaps so hard that even after liquidating all collateral, debt remains, that's bad debt. Example: You borrow $1,000 USDC against 10 tTSLA @ $150 = $1,500 collateral. Over a weekend, tTSLA gaps down to $50. Your collateral is now worth $500. The liquidator repays your full $1,000 debt but can only seize $500 of collateral. $500 of bad debt is realized."
          },
          {
            "type": "p",
            "text": "When bad debt is realized, the vault emits a BadDebtRealized event. The protocol's 15% reserve factor (skimmed from borrow interest) is the first-loss buffer; any loss beyond the reserve is absorbed by USDC lenders pro-rata. This is why conservative LTVs and the AI risk layer exist: to make bad debt rare, not zero. At mainnet, we will have insurance or a larger safety reserve to absorb anticipated bad debt."
          },
          {
            "type": "h3",
            "text": "Close factor"
          },
          {
            "type": "p",
            "text": "The 50% close factor means a single liquidation can clear at most 50% of your debt. This prevents one liquidator from dominating a liquidation and hoarding the bonus. Exception: if your health factor is below 0.95 (very close to insolvency), the close factor is 100% — your entire debt can be repaid in one call."
          },
          {
            "type": "h3",
            "text": "Collateral liquidation order"
          },
          {
            "type": "p",
            "text": "If you have multiple types of collateral (e.g., tAAPL and tTSLA), the liquidator chooses which token to seize. They might seize the cheapest token (lowest USD price) to maximize their bonus. You have no say in which collateral is taken — only the liquidator decides. This is standard lending-protocol behavior, but it means you should not assume a particular collateral is safer — all your collateral is at risk of liquidation if you're underwater."
          }
        ]
      },
      {
        "title": "Security",
        "slug": "security",
        "blocks": [
          {
            "type": "p",
            "text": "Tessera is a protocol that holds your funds and can move money (via the agent's allowance). Security is foundational. This page explains how we design for safety and what still needs to happen before mainnet."
          },
          {
            "type": "h3",
            "text": "Conservative LTVs"
          },
          {
            "type": "p",
            "text": "The maximum loan-to-value for each collateral is deliberately low:"
          },
          {
            "type": "table",
            "headers": [
              "Collateral",
              "Max LTV",
              "Liquidation Threshold",
              "Gap buffer"
            ],
            "rows": [
              [
                "tAAPL",
                "50%",
                "65%",
                "15%"
              ],
              [
                "tTSLA",
                "40%",
                "55%",
                "15%"
              ],
              [
                "tSPY",
                "60%",
                "75%",
                "15%"
              ]
            ]
          },
          {
            "type": "p",
            "text": "Why so conservative? Gap risk. A typical single-stock can move 3–5% in a single day; on a weekend with earnings or geopolitical news, 10–20% gaps are real. An index like SPY is more stable but still vulnerable. These LTVs assume a 10–20% overnight gap might happen and you'll still have room before liquidation. When the market closes, new borrows are haircut further (e.g., 50% → 42.5% during off-hours). You can still borrow, but less, to price in the extreme gap risk of a multi-day closed market."
          },
          {
            "type": "h3",
            "text": "The deterministic risk core"
          },
          {
            "type": "p",
            "text": "The vault's health factor and liquidation calculations are pure math — no guessing, no discretion. The math is implemented in Rust (Arbitrum Stylus), unit-tested exhaustively, and proven against reference specs."
          },
          {
            "type": "p",
            "text": "Example: your health factor is always collateral_value × liquidation_threshold ÷ debt. Every step saturates (never panics on overflow) and is bounded by unit tests that cover edge cases (zero debt, zero collateral, near-liquidation scenarios)."
          },
          {
            "type": "p",
            "text": "The AI agent (the Watcher) is advisory only. It can read health, send you alerts, and (with your opt-in) execute agentRepayFor() to repay debt from your allowance. But the decision of whether to repay is deterministic: if your health is below threshold X, repay. The LLM only writes the alert copy."
          },
          {
            "type": "h3",
            "text": "Non-custodial design"
          },
          {
            "type": "p",
            "text": "The vault never holds your funds. It holds accounting (who owns what), but the actual USDC and collateral tokens stay in your wallet (or a contract you control)."
          },
          {
            "type": "p",
            "text": "The agent's agentRepayFor() function can only: (1) Reduce your own debt (pull USDC from your allowance and repay the vault). (2) Never withdraw your collateral or USDC. (3) Never move your funds to another address."
          },
          {
            "type": "p",
            "text": "The allowance is both the spending cap and your kill switch: revoke it at any time, and the agent can no longer act."
          },
          {
            "type": "h3",
            "text": "The reserve: first-loss capital"
          },
          {
            "type": "p",
            "text": "The protocol keeps a reserve funded by 15% of all borrow interest. This is the first-loss layer for bad debt: (1) When bad debt happens (collateral runs out, debt remains), the reserve covers it first. (2) USDC lenders only absorb losses after the reserve is exhausted. (3) The reserve is transparent and on-chain; you can read it anytime."
          },
          {
            "type": "p",
            "text": "On testnet, the reserve factor is 15%. At mainnet, we may increase it and/or add insurance to make bad-debt absorption more robust."
          },
          {
            "type": "h3",
            "text": "Dual-feed oracle routing"
          },
          {
            "type": "p",
            "text": "The PriceGuard oracle router can validate against a secondary feed. If the secondary feed deviates sharply from the primary, the vault halts new risk (borrow / withdraw) but allows debt reduction (repay / liquidate). This prevents the protocol from being whipsawed by a bad oracle."
          },
          {
            "type": "p",
            "text": "At testnet, we use a single mock feed. At mainnet, we'll deploy Chainlink as primary + a secondary oracle for validation."
          },
          {
            "type": "h3",
            "text": "Open-source code"
          },
          {
            "type": "p",
            "text": "Everything is public on GitHub: contracts, agent, web UI. You can read the vault's health-factor math, the liquidation logic, and the interest rate curve. Bugs have nowhere to hide. We encourage security researchers to review the code. (Formal bug-bounty program to come at mainnet.)"
          },
          {
            "type": "h3",
            "text": "What's NOT yet in place"
          },
          {
            "type": "p",
            "text": "**The following are hard requirements before any mainnet deployment. Do not confuse shipped code with shipped safety.** (1) **Independent audit**: Testnet software has not been reviewed by external security professionals. A full third-party audit (Arbitrum Foundation grant-funded preferred) is non-negotiable before mainnet. (2) **Insurance / safety net**: On testnet, bad-debt losses go straight to lenders. Mainnet requires insurance (e.g., Sherlock) or an expanded safety reserve. (3) **Permissionless backstop enabled**: The backstop is proven on-chain but will be enabled at mainnet after audit passes. (4) **Real Chainlink oracle**: The testnet mock will be replaced with real Chainlink feeds (and secondary feeds for validation). (5) **US + sanctions geo-block**: The frontend will enforce legal compliance; UI is not available to US persons or sanctioned jurisdictions. (6) **Bug bounty**: A formal Immunefi or equivalent bounty will be live before mainnet. (7) **Mainnet TVL caps**: Caps per asset (e.g., $1M tAAPL supply max initially) to manage risk during the ramp."
          },
          {
            "type": "h3",
            "text": "The agent hot key"
          },
          {
            "type": "p",
            "text": "The agent signs transactions with a single private key (AGENT_PRIVATE_KEY). If this key leaks: (1) An attacker becomes the agent and can call liquidate() and agentRepayFor() at any time. (2) They cannot extract value — agentRepayFor() only reduces debt from a user's pre-approved allowance, and liquidation is limited by the close factor and collateral balance. (3) They can grief: force-repay opted-in users' USDC at bad times, or liquidate positions strategically. Per-user daily caps ($25K/day, $10K/tx) are enforced on-chain to bound the damage."
          },
          {
            "type": "p",
            "text": "Immediate response: Call vault.setAgent(0x0) to revoke the compromised agent. The vault then rejects all agent actions. Provision a fresh key and call setAgent(<new_address>)."
          },
          {
            "type": "h3",
            "text": "Operational security"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              ".env files with secrets are gitignored and never committed. CI enforces this.",
              "AGENT_ADMIN_SECRET (which gates operational endpoints like /metrics, /alerts) has no safe default in production — the agent refuses to boot if it's still the dev default and NODE_ENV=production.",
              "The agent's public HTTP surface is rate-limited and CORS-scoped; sensitive endpoints are bearer-token-gated.",
              "Action logs truncate addresses and round amounts to prevent data leaks."
            ]
          },
          {
            "type": "h3",
            "text": "Responsible disclosure"
          },
          {
            "type": "p",
            "text": "Found a security bug? Do not open a public GitHub issue. Contact the maintainers privately first via email or X DM (see the repo profile) with a description and ideally a reproduction. We aim to acknowledge within 72 hours and will publish a postmortem after a fix ships. This is part of our radical-transparency commitment: if something breaks, we'll tell you what happened."
          }
        ]
      }
    ]
  },
  {
    "title": "Operations & architecture",
    "sections": [
      {
        "title": "Fees & revenue",
        "slug": "fees-revenue",
        "blocks": [
          {
            "type": "h2",
            "text": "Fees & revenue"
          },
          {
            "type": "p",
            "text": "Tessera has no token sales, no deposit fees, no withdrawal fees, and no trading volumes. Revenue comes entirely from a single, transparent source: the **reserve factor** on borrow interest."
          },
          {
            "type": "h3",
            "text": "The reserve factor"
          },
          {
            "type": "p",
            "text": "When a borrower pays interest on their USDC debt, **15%** of that interest flows into an on-chain reserve. The remaining 85% is earned by lenders as yield."
          },
          {
            "type": "table",
            "headers": [
              "Parameter",
              "Value",
              "Purpose"
            ],
            "rows": [
              [
                "Reserve factor",
                "15% of borrow interest",
                "Protocol revenue + first-loss capital"
              ],
              [
                "Close factor",
                "50% max liquidatable per step",
                "Limits liquidation severity"
              ],
              [
                "Liquidator bonus",
                "5% base (ramps with depth)",
                "Backstop liquidation incentive"
              ],
              [
                "Minimum debt",
                "100 USDC",
                "Dust floor"
              ]
            ]
          },
          {
            "type": "p",
            "text": "That reserve serves two purposes: (1) it is protocol revenue, used to fund operations and development, and (2) it acts as **first-loss capital** -- a buffer that absorbs losses before they reach lenders. This means lender yield is protected by an on-chain reserve, not by insurance or a promise."
          },
          {
            "type": "h3",
            "text": "How interest accrues"
          },
          {
            "type": "p",
            "text": "Interest is calculated continuously, at a variable rate. The rate adapts to utilization (how much USDC is borrowed vs. available): at low utilization, rates are low; as more borrowers borrow, rates rise to incentivize deposits or repayment. A hard ceiling of **300%** annual prevents runaway rates."
          },
          {
            "type": "p",
            "text": "On-chain logic deducts the reserve factor in real time. When you check your debt, you see the true amount including accrued interest and reserve deduction -- no surprises."
          },
          {
            "type": "h3",
            "text": "No deposit or withdrawal fees"
          },
          {
            "type": "p",
            "text": "Lending USDC to Tessera is free. No deposit fee. No withdrawal fee. Your yield is simply 85% of the borrow interest across the pool, prorated by your share."
          },
          {
            "type": "h3",
            "text": "No trading or market-making fees"
          },
          {
            "type": "p",
            "text": "Tessera is not an exchange. Collateral (tokenized stocks) is not traded on-chain; it is held as collateral. There are no trading fees, no slippage, no AMM mechanics. You borrow USDC against your tokens; the tokens stay locked in your own vault position."
          },
          {
            "type": "h3",
            "text": "The Watcher's costs"
          },
          {
            "type": "p",
            "text": "The Watcher operates from the reserve. When it repays debt on your behalf (with your pre-approval and on-chain per-user caps), it uses the allowance you grant -- it does not charge a fee above the normal borrow interest. A 15% reserve factor is sustainable: it is enough to fund a small, focused team and shield lenders from catastrophic loss, without creating perverse incentives (like token-sale pressure) or rent-extracting fee structures. It is also honest -- you know where every dollar of revenue comes from."
          }
        ]
      },
      {
        "title": "Supported regions",
        "slug": "supported-regions",
        "blocks": [
          {
            "type": "h2",
            "text": "Supported regions"
          },
          {
            "type": "p",
            "text": "Tessera is **not available to persons in the United States** or **residents of sanctioned jurisdictions** (as designated by OFAC)."
          },
          {
            "type": "h3",
            "text": "Who can use Tessera"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Non-US persons (individuals and entities not located in or controlled by the United States)",
              "Persons outside OFAC-designated jurisdictions (Iran, North Korea, Syria, Crimea, etc.)",
              "Users who comply with local financial regulations in their jurisdiction"
            ]
          },
          {
            "type": "h3",
            "text": "Enforcement"
          },
          {
            "type": "p",
            "text": "Tessera uses on-chain geolocation checks and wallet-based restrictions where possible. However, crypto is pseudonymous; final compliance responsibility rests with the user. By connecting a wallet, you confirm you are not a US person and are not in a sanctioned jurisdiction. Violations of these terms may result in position closure, fund recovery, or legal action."
          },
          {
            "type": "h3",
            "text": "Why this restriction exists"
          },
          {
            "type": "p",
            "text": "US financial regulations (FinCEN, SEC, and CFTC) classify lending and derivatives as financial services requiring licenses Tessera does not hold. Tessera is pre-regulatory and testnet-only; when mainnet launch occurs, we will evaluate compliant structures (e.g., a registered broker-dealer partnership or a regulated offshore offering). Until then, US persons are excluded."
          },
          {
            "type": "p",
            "text": "OFAC sanctions are legally required -- not optional. Any transaction touching a sanctioned jurisdiction can expose users, founders, and lenders to civil penalties. Tessera operates on Robinhood Chain testnet with mock USDC and testnet prices. No real funds are at risk. Region restrictions exist to establish good legal habit and to align with eventual mainnet requirements, even though testnet is non-binding. Follow them anyway."
          }
        ]
      },
      {
        "title": "Architecture",
        "slug": "architecture",
        "blocks": [
          {
            "type": "h2",
            "text": "Architecture"
          },
          {
            "type": "p",
            "text": "Tessera is built as a **modular, composable stack** on Arbitrum Stylus (Rust on an Arbitrum Orbit L2). Each component is independent, open-source, and testable in isolation."
          },
          {
            "type": "h3",
            "text": "The four-piece stack"
          },
          {
            "type": "table",
            "headers": [
              "Component",
              "Language",
              "Purpose",
              "Auth"
            ],
            "rows": [
              [
                "Vault",
                "Rust (Stylus)",
                "Collateral and borrow/repay/liquidate logic",
                "On-chain"
              ],
              [
                "PriceGuard",
                "Solidity",
                "Oracle policy, market hours, gap detection",
                "On-chain"
              ],
              [
                "Lens",
                "TypeScript (read-only)",
                "Fetch prices, HF, liquidation data",
                "Public"
              ],
              [
                "Watcher",
                "TypeScript (off-chain)",
                "Monitor, alert, auto-repay (opt-in)",
                "User allowance"
              ]
            ]
          },
          {
            "type": "h3",
            "text": "1. The vault (Stylus, Rust)"
          },
          {
            "type": "p",
            "text": "The vault is the core smart contract. It is written in Rust and compiled to WebAssembly (via Arbitrum Stylus), allowing larger contract sizes than standard EVM contracts -- critical because Tessera's safety-hardened vault with all guards compiled in exceeds a standard Arbitrum L2's 24KB code-size limit."
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "**Deposit (lenders):** USDC in, share tokens out. Mints a proportional stake in the lending pool.",
              "**Borrow (borrowers):** Lock collateral, mint debt. Subject to max LTV (tAAPL 50%, tTSLA 40%, tSPY 60%) and minimum debt (100 USDC).",
              "**Repay:** Burn debt, withdraw USDC. Can be called by any address if debt is repaid from a pre-approved allowance (used by the Watcher with user opt-in).",
              "**Liquidate:** A permissionless backstop liquidates unsafe positions (health factor < liquidation threshold). Base bonus 5%, ramping with depth.",
              "**Reserve accrual:** 15% of borrow interest is siphoned into an on-chain reserve in real time. Lenders earn 85%."
            ]
          },
          {
            "type": "p",
            "text": "The vault enforces **core invariants** at the smart-contract level: no position below minimum debt, no borrows exceeding LTV, no liquidations that drive HF negative, interest accrual on every block."
          },
          {
            "type": "h3",
            "text": "2. PriceGuard (Solidity)"
          },
          {
            "type": "p",
            "text": "PriceGuard is an oracle-policy contract that governs how prices are sourced and applied to collateral. It sits between the price feed and the vault."
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "**Price feed (testnet mock, mainnet gate):** On testnet, prices come from a centralized mock. On mainnet, prices will be sourced from a licensed price oracle (e.g., Chainlink).",
              "**Market hours:** PriceGuard tracks when US markets are open/closed. Outside 9:30 AM to 4:00 PM ET, `setMarketClosed(true)` engages gap haircuts -- conservative risk-weighted discounts applied to each collateral's value.",
              "**Gap detection and haircuts:** When markets are closed or a feed is stale, conservative haircuts automatically apply -- for instance, tAAPL and tTSLA may be haircut 10-15% overnight, reducing borrowing power until markets reopen and the Watcher confirms no overnight gaps occurred.",
              "**Testnet mock note:** On Robinhood Chain testnet, prices are static or manually set. This is a testnet gate; a real licensed feed is a mainnet gate."
            ]
          },
          {
            "type": "p",
            "text": "PriceGuard is the structural answer to overnight gaps. By reducing collateral value outside market hours, it prevents positions from being under-collateralized during the 16-hour gap when stocks don't trade but tokenized proxies might."
          },
          {
            "type": "h3",
            "text": "3. Lens (TypeScript, read-only)"
          },
          {
            "type": "p",
            "text": "Lens is a public TypeScript library that reads data from the vault (no write permissions). It is used by the Watcher, the web UI, and any external agent to fetch:"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "Current collateral prices (from PriceGuard)",
              "A user's debt, collateral, and health factor",
              "Pool state (total deposits, total borrows, interest rate)",
              "Liquidation candidate lists and liquidation prices"
            ]
          },
          {
            "type": "p",
            "text": "Lens is stateless and immutable. It only reads; it never modifies state. This makes it safe to use in parallel without locking or race conditions."
          },
          {
            "type": "h3",
            "text": "4. The Watcher (TypeScript, off-chain)"
          },
          {
            "type": "p",
            "text": "The Watcher is an autonomous off-chain agent (a TypeScript service) that runs independently and continuously. It is the **active risk layer** -- the structural answer to liquidation before it happens."
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "**Monitor (every ~10 seconds):** Fetches the health factor of every active borrower via Lens. Checks if HF is approaching the liquidation threshold.",
              "**Alert (plain-English):** If HF drops below a critical threshold, the Watcher sends a plain-language alert to the user (via email, Telegram, or on-chain).",
              "**Auto-repay (with user approval and on-chain caps):** If a user has pre-approved a USDC allowance, and their HF is critically low, the Watcher can call the vault's `repay()` function. This is done **deterministically** (not with an LLM making the decision) and bounded by on-chain per-user caps: 25,000 USDC/user/day, 10,000 USDC/user/tx.",
              "**Heartbeat (on-chain record):** Every minute, the Watcher writes an on-chain heartbeat transaction. If the Watcher goes silent (> 15 min on testnet), a permissionless backstop mechanism activates.",
              "**Kill switch:** Users can revoke the Watcher's allowance at any time, instantly stopping auto-repays. Plus, the protocol has an on-chain admin failsafe to pause the agent globally if needed."
            ]
          },
          {
            "type": "p",
            "text": "The **decision** to repay (is HF below the critical threshold?) is made deterministically by on-chain logic. The **explanation** (the plain-English alert copy) is written by a language model. The AI never holds funds, never decides whether to move money -- it only narrates what is happening."
          },
          {
            "type": "h3",
            "text": "Data flow (happy path)"
          },
          {
            "type": "list",
            "ordered": true,
            "items": [
              "A borrower deposits collateral (tAAPL) and borrows 5,000 USDC at an LTV of 50%.",
              "The vault records the position: collateral amount, debt, interest rate.",
              "Every block, interest accrues. 15% flows to the reserve; 85% is earned by lenders.",
              "The Watcher reads the vault via Lens: calculates HF = (collateral value times risk weight) divided by debt.",
              "If HF is healthy (> liquidation threshold), no action. If HF is critical, the Watcher sends an alert.",
              "If the user approved auto-repay and HF is critical, the Watcher calls `repay()` on the vault, using the user's allowance to reduce debt and restore HF.",
              "If a position becomes unsafe (HF < liquidation threshold) and the Watcher cannot restore it, the backstop opens: anyone can liquidate the position and earn the 5% bonus.",
              "Liquidation proceeds are returned to the lender pool; the borrower can re-collateralize and borrow again."
            ]
          },
          {
            "type": "h3",
            "text": "Open-source and auditability"
          },
          {
            "type": "p",
            "text": "All four components are open-source (GitHub). The vault, PriceGuard, and Lens contracts are committed; the Watcher source is also public. This enables community review, external audits, and transparency. On testnet, the code is live and real, so you can see exactly how liquidations, interest accrual, and AI auto-repay work in practice."
          }
        ]
      },
      {
        "title": "No token",
        "slug": "no-token",
        "blocks": [
          {
            "type": "h2",
            "text": "No token"
          },
          {
            "type": "p",
            "text": "Tessera will **never** launch a governance token, a utility token, or any other blockchain asset for fundraising or distribution. This is a founding principle."
          },
          {
            "type": "h3",
            "text": "Why no token"
          },
          {
            "type": "p",
            "text": "Tokens are usually launched to raise money and incentivize early adoption. But they create misaligned incentives: the founding team profits if the token price rises, which tempts them to over-promise, hype features, or exploit early users. Token-funded projects also face regulatory pressure (are they securities?) and face pressure to keep the token price up, regardless of product health. Tessera chose a different path: **revenue from reserves, not from token sales.** When lenders earn yield and borrowers pay interest, 15% flows to the on-chain reserve. That reserve funds the team, the infrastructure, and the Watcher. When we build something people trust, revenue follows naturally."
          },
          {
            "type": "h3",
            "text": "How we fund operations"
          },
          {
            "type": "list",
            "ordered": false,
            "items": [
              "**Reserve factor (15% of borrow interest):** As the market grows and more USDC is borrowed, interest accrual grows, and the reserve grows with it. This revenue model scales with the protocol.",
              "**Founder capital:** The core team is initially funded by founder investment or early angel support (not a public token sale). This aligns us with users: we succeed only if Tessera becomes genuinely valuable.",
              "**No ongoing dilution:** Users will never receive an airdrop of governance tokens, and early depositors are never diluted by a token launch. Your stake in the pool is your stake, full stop."
            ]
          },
          {
            "type": "h3",
            "text": "The credibility advantage"
          },
          {
            "type": "p",
            "text": "No token means no token-price volatility, no token-holder governance disputes, no perverse incentives to hype or cut corners. It means Tessera can state facts honestly -- testnet is testnet, mainnet gates are gates -- without fear of spooking token holders. Investors and users can trust that the team is focused on product, not on keeping a token price up. This is rare in crypto. Most lending protocols launch tokens to fund growth. Tessera is betting that transparency and product quality earn trust faster than hype."
          },
          {
            "type": "h3",
            "text": "Governance and control"
          },
          {
            "type": "p",
            "text": "Without a token, Tessera has **no on-chain governance.** The protocol is run by the founding team (guided by the community, but not voted on by token holders). This means decisions can be made quickly and coherently, without the gridlock that often paralyzes decentralized governance. The downside is clear: centralized control can be abused. That's why we mitigate it with open-source code (every contract, agent, decision visible and auditable), on-chain transparency (all positions, interest rates, liquidations on-chain and immutable), explicit mainnet gates (we publicly commit to governance decentralization, multi-sig controls, and audits before mainnet), and kill switches (users can always revoke the Watcher's allowance; lenders can always withdraw)."
          },
          {
            "type": "h3",
            "text": "Future of governance"
          },
          {
            "type": "p",
            "text": "On mainnet, Tessera may introduce a multi-signature safety council (replacing or supplementing founder control) and a formal upgrade path subject to timelock delays. This is **not** a token-based governance; it is a credible commitment device and a way to distribute control responsibly. No token means the only way the team succeeds is if users succeed. We earn revenue by providing genuine value, not by selling a coin. This is the deepest possible alignment. Judge us by what the protocol earns and what lenders and borrowers experience, not by an asset price."
          }
        ]
      }
    ]
  }
];
