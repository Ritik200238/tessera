# @tessera/web — Tessera Web UI

Next.js 16 (App Router) frontend for the Tessera AI-protected lending protocol.

## Quickstart

```bash
# from the workspace root
pnpm install
pnpm --filter @tessera/web dev
```

The dev server runs at `http://localhost:3000` with Turbopack.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev with Turbopack (HMR + Fast Refresh) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (flat config) over `*.ts(x)` |
| `pnpm typecheck` | `tsc --noEmit` against the strict config |
| `pnpm test` | Vitest + Testing Library |

## Routes (mapped to PRD §9.1 and TDD §5.2)

| Route | PRD feature | Notes |
|---|---|---|
| `/` | Dashboard — Safety Score, agent status, portfolio summary | Server shell + client island; refetches on every new block |
| `/deposit` | Deposit tAAPL/tTSLA/tSPY collateral | Approve → deposit flow; shows USDC equivalent + expected APY |
| `/borrow` | Borrow USDC against collateral | 0–70% LTV slider; client-side projected Safety Score preview |
| `/lend` | Supply / withdraw USDC | Real-time supply APY + utilization gauge |
| `/agent` | Agent activity + NL strategy config | Server-fetches actions from `/actions?limit=50`; POST `/config` proxied through a Next route handler so the admin secret stays server-side |
| `/admin` | Per-user health table, manual liquidate, emergency pause, CSV export | Gated by `NEXT_PUBLIC_ADMIN_ADDRESS` / `NEXT_PUBLIC_OWNER_ADDRESS`; non-privileged callers see read-only mode with CSV export |

## Environment variables

See `.env.example`. The most important keys:

```
NEXT_PUBLIC_CHAIN_ENV       # testnet | fallback | local
NEXT_PUBLIC_RPC_URL         # RPC endpoint for the active chain
NEXT_PUBLIC_RPC_CHAIN_ID    # numeric chain ID (Robinhood Chain ID is TBD — see lib/chain.ts)
NEXT_PUBLIC_RPC_CHAIN_NAME  # display name
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_AGENT_URL       # e.g. http://localhost:8787 (agent HTTP server, TDD §4.7)
NEXT_PUBLIC_ADMIN_ADDRESS   # the agent's hot wallet — gates /admin write actions
NEXT_PUBLIC_OWNER_ADDRESS   # protocol owner — also gates /admin write actions
AGENT_ADMIN_SECRET          # server-only; gates the agent config proxy
```

`NEXT_PUBLIC_CHAIN_ENV=fallback` routes everything to Arbitrum Sepolia (421614) — useful while the Robinhood Chain testnet ID is unconfirmed.

## Architecture

- **wagmi v2 + viem** for chain reads / writes. Config in `lib/wagmi.ts`.
- **ConnectKit** for wallet selection.
- **react-query** stale-time of 10s with block-driven invalidation on the dashboard.
- **Tailwind v4** with CSS-first theming in `app/globals.css`. shadcn-shape primitives live in `components/ui/`.
- **Strict TypeScript**: `noUncheckedIndexedAccess`, no `any`, no `@ts-ignore` in our code.

## Accessibility

The Safety Score badges (`components/health-badge.tsx`) are deliberately redundant: each tone pairs a colour token with a distinct lucide icon (ShieldCheck / Shield / Eye / AlertTriangle / Flame) and explicit label text. This means users with any form of colour-blindness can still differentiate "Safe" from "Liquidating" by shape alone (TDD R2).

Other a11y details:

- Skip-to-content link in the layout
- Visible `:focus-visible` ring globally
- `aria-label` on every icon-only button
- Tabular numerics for all on-chain values
- All sliders/progress bars expose `aria-valuemin/max/now`
- Banner regions use `role="alert"`

## Deploying to Vercel

The `web/` directory is a standard Next.js app — set the root directory to `web` in the Vercel project, point `NEXT_PUBLIC_*` to your testnet config in the dashboard, and `AGENT_ADMIN_SECRET` as an encrypted env var (server-only). No additional Vercel products required (TDD §20.3 keeps the stack minimal).

## What's still wired to a placeholder

| Thing | Status | Where it unblocks |
|---|---|---|
| Robinhood Chain ID + RPC | Parameterised via env, no hard-coded ID | Network team publishes the values |
| `shared/abis/TesseraVault.json` | Falls back to a hand-derived ABI from TDD §3.3 | `cargo stylus export-abi` lands in CI |
| `shared/addresses/<env>.json` | Empty `null`s; UI renders "Vault not yet deployed" | After contracts deploy |
