import type { Block } from "@/components/prose";

export interface FaqItem { q: string; answer: Block[]; }
export interface FaqGroup { group: string; items: FaqItem[]; }

export const faqGroups: FaqGroup[] = [
  {
    "group": "How Tessera works",
    "items": [
      {
        "q": "What is Tessera?",
        "answer": [
          {
            "type": "p",
            "text": "Tessera lets you borrow USDC against tokenized stocks like tAAPL, tTSLA, and tSPY. An autonomous agent we call **the Watcher** watches every position around the clock to head off liquidations before they happen."
          },
          {
            "type": "p",
            "text": "Two sides use it: lenders supply USDC and earn yield from borrower interest; borrowers post tokenized-stock collateral and draw USDC against it. Our tagline sums up the goal: \"The safest place to borrow against tokenized stocks.\""
          },
          {
            "type": "callout",
            "tone": "info",
            "body": "Tessera runs on Robinhood Chain, an Arbitrum Orbit L2 (chain 46630), in testnet. It is not open to real funds yet. The numbers and contracts described here are real and on-chain, but no real money is at stake today.",
            "title": "Live on testnet only"
          }
        ]
      },
      {
        "q": "Why does borrowing against tokenized stocks need a special protocol?",
        "answer": [
          {
            "type": "p",
            "text": "Tokenized stocks trade 24/7, but the stock market behind them doesn't. Prices gap overnight and over weekends when no one can react, and ordinary lending positions get liquidated in their sleep."
          },
          {
            "type": "p",
            "text": "Tessera's answer is structural: conservative, gap-aware borrowing limits plus an AI risk layer that watches positions continuously and can act before a gap turns into a forced sale."
          }
        ]
      },
      {
        "q": "How do I earn as a lender?",
        "answer": [
          {
            "type": "p",
            "text": "You supply USDC to the vault. Borrowers pay interest on what they draw, and that interest accrues to lenders in proportion to what they've supplied. You can withdraw your USDC plus accrued interest subject to available liquidity in the pool."
          },
          {
            "type": "p",
            "text": "**Yield is variable and not guaranteed** — it depends on how much is borrowed and at what rate. A share of borrower interest (the reserve factor) is set aside before yield is paid; see the fees section."
          },
          {
            "type": "callout",
            "tone": "warning",
            "body": "Today this runs on testnet with test tokens, so there is no real yield and no real return. We never promise a rate of return.",
            "title": "Testnet"
          }
        ]
      },
      {
        "q": "How do I borrow?",
        "answer": [
          {
            "type": "p",
            "text": "Deposit a supported tokenized stock as collateral, then borrow USDC up to that asset's maximum loan-to-value. You repay whenever you like; interest accrues on the outstanding balance until you do."
          },
          {
            "type": "list",
            "ordered": true,
            "items": [
              "Deposit collateral (tAAPL, tTSLA, or tSPY).",
              "Borrow USDC up to the asset's max LTV.",
              "Stay above a health factor of 1.0, or let the Watcher help you (optional).",
              "Repay USDC any time to free your collateral."
            ]
          },
          {
            "type": "p",
            "text": "There is a minimum debt of **100 USDC** per position to avoid uneconomical dust loans."
          }
        ]
      },
      {
        "q": "What is the health factor?",
        "answer": [
          {
            "type": "p",
            "text": "The health factor (HF) is a single number that tells you how safe your loan is. It's your collateral value, risk-weighted by each asset's liquidation threshold, divided by your debt."
          },
          {
            "type": "p",
            "text": "**1.0 is the liquidation line.** Above 1.0 you're safe; the higher, the more buffer. Below 1.0 your position can be liquidated. The Watcher's job is to keep you comfortably above that line."
          }
        ]
      },
      {
        "q": "What collateral is supported?",
        "answer": [
          {
            "type": "p",
            "text": "Three tokenized stocks today, each with conservative, gap-aware limits set on-chain. The max LTV is how much you can borrow against the asset; the liquidation threshold is the point at which the position becomes liquidatable."
          },
          {
            "type": "table",
            "headers": [
              "Collateral",
              "Asset",
              "Max LTV",
              "Liquidation threshold"
            ],
            "rows": [
              [
                "tAAPL",
                "Apple",
                "50%",
                "65%"
              ],
              [
                "tTSLA",
                "Tesla",
                "40%",
                "55%"
              ],
              [
                "tSPY",
                "S&P 500 ETF",
                "60%",
                "75%"
              ]
            ]
          },
          {
            "type": "p",
            "text": "These limits are intentionally lower than typical lending markets, precisely because tokenized stocks can gap when the underlying market is closed."
          }
        ]
      },
      {
        "q": "What is the tech stack, and is it open source?",
        "answer": [
          {
            "type": "p",
            "text": "The core is built on **Arbitrum Stylus** (Rust): a vault contract, a **PriceGuard** oracle-policy contract, and a read-only **Lens** for data. A TypeScript agent runs the Watcher off-chain but can only act through the vault's permissioned, capped entrypoints."
          },
          {
            "type": "p",
            "text": "It's open source. You can read the code at [github.com/Ritik200238/tessera](https://github.com/Ritik200238/tessera)."
          }
        ]
      }
    ]
  },
  {
    "group": "What the AI actually does",
    "items": [
      {
        "q": "What does the Watcher monitor?",
        "answer": [
          {
            "type": "p",
            "text": "It watches every borrower's health factor around the clock, re-checking roughly **every 10 seconds**. When a position drifts toward danger, it sends a plain-English alert so you know before things get tight."
          },
          {
            "type": "p",
            "text": "If you've opted in, it can also act — auto-repaying part of your debt to head off a liquidation. What it can and can't do is spelled out below."
          }
        ]
      },
      {
        "q": "Can the AI move my money?",
        "answer": [
          {
            "type": "p",
            "text": "Only in one narrow, user-authorized way: it can **reduce your own debt** using USDC you pre-approved, and nothing else. It never custodies your funds and can never move them to anyone."
          },
          {
            "type": "callout",
            "tone": "info",
            "body": "Auto-repay is bounded by hard, on-chain per-user limits: 25,000 USDC per user per day and 10,000 USDC per user per transaction. These caps are enforced by the contract, not by the agent.",
            "title": "On-chain caps"
          }
        ]
      },
      {
        "q": "Which AI model do you use, and does it decide to move money?",
        "answer": [
          {
            "type": "p",
            "text": "**No — a model never decides whether to move money.** Every financial decision is made by a deterministic core: fixed rules that produce the same output for the same inputs, with no model in the loop."
          },
          {
            "type": "p",
            "text": "A language model is used only to write the human-readable copy — turning a decision the deterministic core already made into a clear alert you can understand. This split is deliberate: the part that touches your money is auditable and predictable."
          }
        ]
      },
      {
        "q": "How do I turn the AI off?",
        "answer": [
          {
            "type": "p",
            "text": "Revoke the USDC allowance you granted. That's the single kill switch — once revoked, the Watcher physically cannot touch your position, because its only power was that allowance."
          },
          {
            "type": "p",
            "text": "There is also an on-chain admin fail-safe so the protocol can halt the agent if something goes wrong. Either path stops it immediately."
          }
        ]
      },
      {
        "q": "What happens if the AI agent goes down?",
        "answer": [
          {
            "type": "p",
            "text": "The agent stamps an on-chain **heartbeat** as it runs. A permissionless backstop is built and tested so that, once enabled, anyone can step in and liquidate if the agent goes silent past the configured delay — so the protocol doesn't depend on our agent staying up. On testnet the delay is set to 0 (backstop off, liquidation is agent-only); turning it on is an explicit mainnet gate."
          },
          {
            "type": "p",
            "text": "Your funds are never trapped by the agent being offline; normal repay and withdraw functions remain available directly on the vault."
          }
        ]
      },
      {
        "q": "Does opting in to the Watcher cost me anything or give it control?",
        "answer": [
          {
            "type": "p",
            "text": "Opting in means setting a USDC allowance the Watcher can draw on solely to repay your debt. You set the amount, you can change or revoke it any time, and the on-chain caps still apply on top of it."
          },
          {
            "type": "p",
            "text": "It does not give the agent custody, withdrawal rights, or any ability to act outside reducing your own debt."
          }
        ]
      },
      {
        "q": "Can the AI guarantee I won't be liquidated?",
        "answer": [
          {
            "type": "callout",
            "tone": "warning",
            "body": "The Watcher reduces liquidation risk; it cannot eliminate it. A severe enough overnight or weekend gap can move your position past the line faster than any repay can react. Always size your borrow with that in mind.",
            "title": "No guarantee"
          }
        ]
      }
    ]
  },
  {
    "group": "What are the risks",
    "items": [
      {
        "q": "What if my collateral gaps down on Monday morning?",
        "answer": [
          {
            "type": "p",
            "text": "This is the core risk Tessera is built around. Conservative LTVs and liquidation thresholds leave a buffer for exactly this, and the Watcher tries to repay into the gap. But a large enough gap can still cross the liquidation line before anything can react."
          },
          {
            "type": "p",
            "text": "The honest takeaway: the design lowers this risk meaningfully, it does not remove it. Borrow with room to spare."
          }
        ]
      },
      {
        "q": "What happens during a liquidation?",
        "answer": [
          {
            "type": "p",
            "text": "If your health factor falls below 1.0, a liquidator can repay part of your debt and receive your collateral at a discount. The base liquidator bonus is **5%** (it ramps with depth). The close factor is **50%**, meaning at most half a position is liquidated in one step — except below a health factor of **0.95**, where a full close is allowed."
          },
          {
            "type": "p",
            "text": "Liquidation is how the pool stays solvent for lenders. The buffers and the Watcher exist to make it rare, not impossible."
          }
        ]
      },
      {
        "q": "What if the price oracle fails or returns a bad price?",
        "answer": [
          {
            "type": "p",
            "text": "A dedicated **PriceGuard** contract sits between the price feed and the vault, enforcing sanity checks and policy on prices before they're used — so a single bad or stale print doesn't immediately drive liquidations."
          },
          {
            "type": "callout",
            "tone": "warning",
            "body": "Today the on-chain price feed is a testnet mock. Integrating a real, licensed market-data feed is a mainnet gate — it is not shipped yet. PriceGuard's policy logic is real and on-chain regardless of the feed behind it.",
            "title": "Testnet price feed is a mock"
          }
        ]
      },
      {
        "q": "Is Tessera audited?",
        "answer": [
          {
            "type": "callout",
            "tone": "danger",
            "body": "Tessera has not been audited. A third-party security audit is a mainnet gate — it has not happened yet. The code is open source so you can review it, but open source is not a substitute for an audit.",
            "title": "Not audited"
          },
          {
            "type": "p",
            "text": "We will not present an audit, or any security claim, that we don't actually have."
          }
        ]
      },
      {
        "q": "What are the smart-contract and protocol risks?",
        "answer": [
          {
            "type": "p",
            "text": "As with any DeFi protocol, the contracts could contain bugs, the interest-rate or liquidation logic could behave unexpectedly under stress, and an unaudited codebase carries real risk. The interest-rate curve is capped (a hard ceiling), and risk parameters are conservative, but no design is risk-free."
          },
          {
            "type": "p",
            "text": "Because this is testnet with no real funds, today's risk is to test assets only. That changes at mainnet, which is why audit and a real price feed are gates."
          }
        ]
      },
      {
        "q": "Could I lose money lending?",
        "answer": [
          {
            "type": "p",
            "text": "In principle, yes — in any lending protocol, extreme market moves or bad debt can leave the pool short. The reserve factor builds a first-loss reserve to absorb shortfalls first, and conservative limits reduce the chance of bad debt, but there is no insurance and no guarantee of repayment."
          },
          {
            "type": "callout",
            "tone": "warning",
            "body": "Tessera does not offer deposit insurance or any guarantee of funds. We will never claim otherwise.",
            "title": "No insurance"
          }
        ]
      }
    ]
  },
  {
    "group": "Fees, regions, token & team",
    "items": [
      {
        "q": "What are the fees?",
        "answer": [
          {
            "type": "p",
            "text": "There's no separate platform fee on deposits or withdrawals. The protocol's only economic take is the **reserve factor: 15% of borrow interest**, which funds protocol revenue and a first-loss reserve. Lenders earn the remaining interest."
          },
          {
            "type": "p",
            "text": "Borrowers also pay a liquidator a **5% base bonus** only if they get liquidated; that's an incentive paid to liquidators, not a fee Tessera collects."
          }
        ]
      },
      {
        "q": "Is there a token?",
        "answer": [
          {
            "type": "callout",
            "tone": "info",
            "body": "Tessera has no token and will never launch one. There is no airdrop, no presale, and no coin to buy. Anyone claiming to sell a Tessera token is running a scam.",
            "title": "No token, ever"
          }
        ]
      },
      {
        "q": "How do you make money, then?",
        "answer": [
          {
            "type": "p",
            "text": "From the **reserve factor** — the 15% share of borrower interest described above. It's transparent, on-chain, and tied directly to real usage of the protocol. Revenue grows only if people actually borrow."
          },
          {
            "type": "p",
            "text": "We deliberately do not monetize through a token sale, because token incentives tend to distort a protocol away from the users it's meant to serve."
          }
        ]
      },
      {
        "q": "Which countries and users are supported?",
        "answer": [
          {
            "type": "callout",
            "tone": "warning",
            "body": "Tessera is not available to US persons or to anyone in sanctioned jurisdictions. You are responsible for ensuring access is lawful where you are.",
            "title": "Regional restrictions"
          },
          {
            "type": "p",
            "text": "These restrictions apply now and will carry into any mainnet launch."
          }
        ]
      },
      {
        "q": "Who is behind Tessera?",
        "answer": [
          {
            "type": "p",
            "text": "Tessera is founder-led and built in the open. Team bios are being finalized; in the meantime the work speaks for itself — the code, parameters, and disclosures are all public."
          },
          {
            "type": "p",
            "text": "You can follow the build and read the code at [github.com/Ritik200238/tessera](https://github.com/Ritik200238/tessera)."
          }
        ]
      },
      {
        "q": "Is this live and real, or just a demo?",
        "answer": [
          {
            "type": "p",
            "text": "It's real and deployed — the vault, PriceGuard, Lens, and the Watcher all run live on **Robinhood Chain (chain 46630)**, an Arbitrum Orbit L2 — but on **testnet**, not mainnet."
          },
          {
            "type": "callout",
            "tone": "info",
            "body": "The contracts and the agent are genuinely running with the real parameters described in this FAQ, but with test tokens and no real funds. Mainnet gates — a security audit and a real licensed price feed — must be cleared before Tessera opens to real money.",
            "title": "What \"testnet\" means here"
          }
        ]
      }
    ]
  }
];
