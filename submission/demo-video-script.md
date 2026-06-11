# Tessera — Demo Video Script (~3 minutes)

Target: buildathon judges. One idea per shot, the Live Drill as the centerpiece.
Record at 1440p, dark room audio, no music under the drill (let the moment land).

---

## Shot 1 — The problem (0:00–0:25) · landing page on screen

> "Tokenized stocks trade twenty-four-seven. But the real market closes at four.
> So these assets GAP — overnight, over weekends, on earnings. If you've borrowed
> against them, a Monday-morning gap can liquidate you while you sleep.
> Generic money markets react *after* the damage. Tessera acts *before*."

On screen: scroll the hero → the Gap-Risk Clock ("Closes in 2h → weekend. Protect
target rises 1.40 → 1.70").

## Shot 2 — What Tessera is (0:25–0:50) · /start then /borrow

> "Tessera is an AI-protected lending protocol on Arbitrum Stylus. Lenders supply
> USDC and earn. Borrowers post tokenized stocks — Apple, Tesla, S&P — and borrow
> against them. And an autonomous agent watches every position, every block."

On screen: the guided walk (/start), then the borrow form — point at the
liquidation price + projected Safety Score, and the pre-borrow gap modal.

## Shot 3 — The trust boundary (0:50–1:10) · /agent

> "The agent can only ever *reduce* your debt, using USDC you pre-approve. Your
> approval is the spending cap — and the kill switch. The AI never holds funds,
> and a language model never moves money. Deterministic code decides; the
> contract enforces."

On screen: Active Protection card → cap → kill switch. "Where you stand" card.

## Shot 4 — THE LIVE DRILL (1:10–2:10) · /drill — the centerpiece

> "Don't take my word for it. YOU pick the crash. This button opens a real loan
> on the live vault, gaps its collateral by the size you choose — say forty
> percent — and the production agent, the same one watching real users, has to
> notice and save it. No script. Watch."

On screen: pick **−40%**, click **Crash it −40% and watch**. Let the stepper run
UNCUT: open the position → gap the price → *danger zone* → the agent auto-repays
from the pre-approved cap and the health factor is restored. Alongside it, the
**unprotected twin** hit by the same gap is **liquidated**. Click the rescue tx →
Arbiscan. (Capture the exact repay amount + restored HF live from the run — don't
script numbers.)

> "Seconds later — restored. The agent repaid from the pre-approved cap to the
> regime target (weekend-aware, because gap risk isn't constant), while the
> unprotected position was liquidated by the same gap. Every step is a real
> transaction you can open on Arbiscan."

## Shot 5 — Proof, not promises (2:10–2:35) · /transparency

> "Is the protection real in general? We backtest it: across nine modeled
> overnight, weekend, and earnings gaps, regime-aware protection avoided
> liquidation in seventy-five percent of the cases that wiped out an unprotected
> position. That number is locked behind a CI test in the repo — if it rots, our
> build fails. Reproduce it with one command."

On screen: the backtest card → the protection track record (bad debt: $0) →
the de-noised agent feed with the decision record + tx hash.

## Shot 6 — Why this wins long-term (2:35–3:00) · /roadmap + /security

> "No token — ever. Revenue is a fifteen-percent reserve factor. The vault is
> Rust on Arbitrum Stylus; the backstop liquidator and dual-oracle guard are
> written, tested, and gated behind an independent audit — the one hard gate
> before real funds. Tokenized equities are coming on-chain fast. Someone has to
> be the risk layer that lets people sleep. That's Tessera."

On screen: /roadmap (live → next → gates), /security trust model, GitHub repo
(CI green, test counts).

---

### Recording checklist
- [ ] Run the oracle-keeper workflow + one warm-up drill ~10 min before recording
      (Render must be awake; cooldown clear).
- [ ] Wallet connected with a small real position so dashboards show live data.
- [ ] Browser at 100% zoom, console closed, bookmarks bar hidden.
- [ ] Do ONE full rehearsal — the drill cooldown is 10 minutes, plan takes.
