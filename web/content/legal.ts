import type { Block } from "@/components/prose";

export const privacyBlocks: Block[] = [
  {
    "type": "callout",
    "tone": "info",
    "body": "This is a plain-language, interim privacy policy for the Tessera testnet. It is not legal advice. A counsel-reviewed version is a mainnet gate: it will replace this page before Tessera ever opens to real funds.",
    "title": "Interim policy — not legal advice"
  },
  {
    "type": "p",
    "text": "Tessera is currently a testnet product. The only personal data we handle today comes from one place: the early-access waitlist. The protocol itself is non-custodial and runs on a public blockchain (Robinhood Chain, an Arbitrum Orbit testnet) — we do not operate accounts, hold balances, or collect identity documents."
  },
  {
    "type": "h2",
    "text": "What we collect"
  },
  {
    "type": "p",
    "text": "We keep this deliberately small. If you join the waitlist, we collect:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "**Your email address** — so we can contact you about early access.",
      "**Your use-case answer** — the short, optional response to \"what would you borrow against, and why?\" This helps us understand who Tessera is for. Plain text, capped in length, never required to be personal.",
      "**Privacy-respecting, aggregate analytics** — anonymous, cookieless usage statistics (for example, which pages are viewed and how the waitlist funnel performs), used only in aggregate to improve the product."
    ]
  },
  {
    "type": "p",
    "text": "If you connect a wallet to use the testnet, your wallet address is a public, on-chain value handled by your wallet and the blockchain — not data we ask for or store in a profile."
  },
  {
    "type": "callout",
    "tone": "success",
    "body": "We do not set cookies for tracking and we do not fingerprint your device or browser. Our analytics are cookieless and aggregate by design — we cannot use them to single you out or follow you across the web.",
    "title": "No tracking cookies, no fingerprinting"
  },
  {
    "type": "h2",
    "text": "How we use it"
  },
  {
    "type": "p",
    "text": "We use your information for one purpose only:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "To email you about Tessera early access, and occasional product updates you can opt out of at any time.",
      "To understand demand and improve the product, using your use-case answer and aggregate analytics."
    ]
  },
  {
    "type": "callout",
    "tone": "warning",
    "body": "We do not sell, rent, or trade your email or any other information. We do not share it for advertising. We do not run third-party ad trackers. Your data is used by us, for the purposes above, and nothing else.",
    "title": "We never sell your data"
  },
  {
    "type": "h2",
    "text": "Where it lives, and how long"
  },
  {
    "type": "p",
    "text": "Waitlist entries are stored by our own service. We retain your email and use-case answer only for as long as we run the waitlist, or until you ask us to delete it — whichever comes first. We keep what we need to contact you about early access, and no more."
  },
  {
    "type": "h2",
    "text": "Service providers"
  },
  {
    "type": "p",
    "text": "We rely on a small number of infrastructure providers — for hosting the website and the analytics described above. They process data on our behalf and only to deliver their service. We choose providers with privacy-respecting defaults and do not authorize them to use your data for their own purposes."
  },
  {
    "type": "h2",
    "text": "Your rights"
  },
  {
    "type": "p",
    "text": "Regardless of where you live, you can ask us to:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "**Access** the information we hold about you.",
      "**Correct** it if it is wrong.",
      "**Delete** it — we will remove your waitlist entry on request.",
      "**Withdraw consent** — unsubscribe from emails at any time via the link in any message, or by contacting us."
    ]
  },
  {
    "type": "p",
    "text": "To exercise any of these, email us (see Contact below). We will not make you jump through hoops."
  },
  {
    "type": "h2",
    "text": "Children"
  },
  {
    "type": "p",
    "text": "Tessera is not intended for anyone under 18, and we do not knowingly collect information from minors."
  },
  {
    "type": "h2",
    "text": "Regions"
  },
  {
    "type": "p",
    "text": "Tessera is not available to US persons or to residents of sanctioned jurisdictions. Joining the waitlist is informational only and is not an offer of any financial product."
  },
  {
    "type": "h2",
    "text": "Changes to this policy"
  },
  {
    "type": "p",
    "text": "As Tessera matures toward mainnet, this interim policy will be replaced by a counsel-reviewed version. If we make a material change before then, we will update this page and, where appropriate, notify waitlist members by email."
  },
  {
    "type": "h2",
    "text": "Contact"
  },
  {
    "type": "p",
    "text": "Questions, or a request about your data? Email us at [hello@tessera.xyz](mailto:hello@tessera.xyz). The project is open-source; you can also reach us through the [GitHub repository](https://github.com/Ritik200238/tessera)."
  }
];
export const disclaimerBlocks: Block[] = [
  {
    "type": "callout",
    "tone": "info",
    "body": "This is a plain-language, interim disclaimer for the Tessera testnet. Nothing here is legal, financial, investment, or tax advice. A counsel-reviewed version is a mainnet gate and will replace this page before Tessera ever opens to real funds.",
    "title": "Interim disclaimer — not legal or financial advice"
  },
  {
    "type": "callout",
    "tone": "warning",
    "body": "Tessera runs on the Robinhood Chain testnet (an Arbitrum Orbit L2, chain 46630). Tokens, prices, and balances are test values with no monetary worth. Tessera is not open to real funds, and nothing on this site is an offer, solicitation, or recommendation to buy, sell, or hold any asset.",
    "title": "Testnet only — no real money"
  },
  {
    "type": "h2",
    "text": "Not financial or investment advice"
  },
  {
    "type": "p",
    "text": "Tessera is software — a non-custodial lending protocol and an interface to it. It does not give advice. Information on this site, including risk parameters, the behavior of the AI agent (\"the Watcher\"), and any examples, is provided for general understanding only. It is not personalized financial, investment, legal, accounting, or tax advice, and it does not account for your circumstances. Decisions you make are your own. Consider getting independent professional advice before acting."
  },
  {
    "type": "h2",
    "text": "Experimental and unaudited"
  },
  {
    "type": "p",
    "text": "Tessera is early-stage, experimental software under active development. The smart contracts have **not** been independently audited. A formal security audit is a mainnet gate, not something we have today. On testnet, the on-chain price feed is a **mock**: it holds simulated last-close values refreshed by a keeper, not a live licensed market data feed. A real, licensed feed is a mainnet gate. Bugs, downtime, and unexpected behavior are possible. Do not treat the testnet as a finished, production-grade financial product."
  },
  {
    "type": "h2",
    "text": "What the Watcher can and cannot do"
  },
  {
    "type": "p",
    "text": "Stated plainly so there is no false comfort:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "The Watcher **does** check your health factor around the clock (about every 10 seconds), send plain-English alerts, and — only if you opt in — auto-repay from USDC you have pre-approved, bounded by on-chain caps of 25,000 USDC per user per day and 10,000 per transaction.",
      "It **does not** custody your funds. It can only reduce your own debt through an allowance you grant and can revoke at any time. Revoking that allowance is your single kill switch; an on-chain admin fail-safe also exists.",
      "It **does not** use a language model to decide whether to move money. A deterministic core makes every financial decision; the language model only writes the human-readable copy.",
      "It **cannot** guarantee protection. A severe enough overnight or weekend price gap can still liquidate a position before protection acts, and the monitoring infrastructure is best-effort with no uptime guarantee."
    ]
  },
  {
    "type": "callout",
    "tone": "danger",
    "body": "The protocol and this interface are provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. To the maximum extent permitted by law, the contributors are not liable for any loss arising from use of the protocol or interface — including agent downtime, oracle failure, liquidation, smart-contract behavior, or your own decisions.",
    "title": "Provided \"as is\" — no warranty"
  },
  {
    "type": "h2",
    "text": "You are responsible for your keys and your compliance"
  },
  {
    "type": "p",
    "text": "Tessera is non-custodial: you alone control your wallet and private keys. If you lose your keys or approve a malicious transaction, no one — including us — can recover your assets. You are responsible for the security of your keys and devices, for understanding what you sign, and for your own legal, regulatory, and tax compliance in your jurisdiction."
  },
  {
    "type": "h2",
    "text": "Regulatory uncertainty for tokenized equities"
  },
  {
    "type": "p",
    "text": "Tokenized stocks and lending against them sit in an evolving and uncertain regulatory landscape. The legal treatment of these assets differs by jurisdiction and may change. Tessera makes no representation that its testnet, or any future mainnet, complies with the laws of any particular place. The regulatory posture of any mainnet launch is subject to legal review and is itself a mainnet gate."
  },
  {
    "type": "h2",
    "text": "Regions"
  },
  {
    "type": "p",
    "text": "Tessera is **not available to US persons or to residents of sanctioned jurisdictions.** It is your responsibility not to access or use the protocol where doing so would be unlawful."
  },
  {
    "type": "h2",
    "text": "No token"
  },
  {
    "type": "p",
    "text": "Tessera has no token and will never launch one. Anyone promoting a \"Tessera token,\" airdrop, or presale is not us and should be treated as a scam. Protocol revenue comes only from a transparent reserve factor on borrow interest — never from selling a coin."
  }
];
export const brandBlocks: Block[] = [
  {
    "type": "callout",
    "tone": "info",
    "body": "This is a plain-language, interim summary of how Tessera's code is licensed and how the Tessera name and marks may be used. It is not legal advice. The authoritative terms are the LICENSE file in the source repository; where this page and that file differ, the repository governs. A counsel-reviewed version is a mainnet gate.",
    "title": "Interim guidelines — not legal advice"
  },
  {
    "type": "h2",
    "text": "The code is open-source"
  },
  {
    "type": "p",
    "text": "Tessera is built in the open. The smart contracts (the Stylus vault, the PriceGuard oracle-policy contract, and the read-only Lens), the TypeScript agent, and this web interface are public in the [project repository](https://github.com/Ritik200238/tessera) under a permissive open-source license."
  },
  {
    "type": "p",
    "text": "Under a permissive license, you may generally use, copy, modify, and redistribute the code — including for commercial purposes — provided you keep the copyright notice and license text intact. The code is provided without warranty and without liability, as stated in the license and in our [disclaimer](/disclaimer). For the exact terms, read the `LICENSE` file in the repository; it is what governs."
  },
  {
    "type": "callout",
    "tone": "warning",
    "body": "Open-sourcing the code does not give you rights to the \"Tessera\" name, logo, or other brand marks. Software licenses and trademark rights are separate. You can fork and ship the code; you cannot present your fork as Tessera.",
    "title": "The license covers the code, not the name"
  },
  {
    "type": "h2",
    "text": "Using the Tessera name and marks"
  },
  {
    "type": "p",
    "text": "The point of these guidelines is simple: people should never be confused about whether something is the official Tessera, or be misled about its safety. With that in mind:"
  },
  {
    "type": "h3",
    "text": "You may"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "Use the name \"Tessera\" to refer to this project accurately — in articles, reviews, research, documentation, and tutorials.",
      "State truthfully that your work is \"built on Tessera,\" \"compatible with Tessera,\" or \"a fork of Tessera,\" as long as it is clear you are not the official project.",
      "Link to the official site and the [GitHub repository](https://github.com/Ritik200238/tessera)."
    ]
  },
  {
    "type": "h3",
    "text": "You may not"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "Use the Tessera name or marks for your own product, fork, token, or service in a way that suggests it is official, endorsed by, or affiliated with Tessera.",
      "Imply a partnership, endorsement, or affiliation that does not exist.",
      "Use the name or marks for anything misleading, fraudulent, or unlawful — including any \"Tessera token,\" airdrop, presale, or fundraise. **Tessera has no token and will never launch one;** any such offer is a scam and is not us.",
      "Modify the marks, or combine them with your own, in ways that create confusion."
    ]
  },
  {
    "type": "h2",
    "text": "If you fork the code"
  },
  {
    "type": "p",
    "text": "Forks are welcome — that is the point of open source. If you run a modified version, please rename it. Give your project its own name and identity so users can tell it apart from the official Tessera. Keep the license and attribution notices required by the `LICENSE` file, and make clear that your fork is not affiliated with or endorsed by us."
  },
  {
    "type": "h2",
    "text": "How to reference the project"
  },
  {
    "type": "p",
    "text": "For a consistent reference:"
  },
  {
    "type": "list",
    "ordered": false,
    "items": [
      "**Name:** Tessera (capital T, no stylization).",
      "**One-line description:** \"The safest place to borrow against tokenized stocks.\"",
      "**What it is:** an AI-protected, non-custodial protocol for borrowing USDC against tokenized stocks, currently live on testnet.",
      "**Status:** always describe it as live on testnet, not as a live production product handling real funds."
    ]
  },
  {
    "type": "h2",
    "text": "Questions"
  },
  {
    "type": "p",
    "text": "Unsure whether a use is allowed, or want permission for something these guidelines do not cover? Email us at [hello@tessera.xyz](mailto:hello@tessera.xyz). We would rather answer a question than have anyone guess."
  }
];
