"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mark } from "@/components/mark";
import { useProtocolStats, formatUsdcUsd } from "@/lib/protocol";
import "./landing.css";

/* ----------------------------------------------------------------------------
 * Tessera landing — React port of the Claude Design handoff (Tessera Landing.html
 * + landing.css + landing.js). Same brand system, same interactions: animated
 * mosaic hero, live NYSE market-hours pill, count-up stats, reveal-on-scroll,
 * the interactive Health-Factor simulator (the contract's actual math), and the
 * auto-playing AI-rescue timeline.
 * ------------------------------------------------------------------------- */

type Zone = { k: string; lbl: string; col: string; wash: string };

const ASSETS = {
  TSLA: { name: "Tesla, Inc.", ltv: 0.4, liq: 0.55, px: 342.18, gap: 0.15, sector: "Consumer" },
  AAPL: { name: "Apple Inc.", ltv: 0.5, liq: 0.65, px: 214.55, gap: 0.08, sector: "Technology" },
  NVDA: { name: "NVIDIA Corp.", ltv: 0.4, liq: 0.55, px: 131.26, gap: 0.13, sector: "Technology" },
  SPY: { name: "SPDR S&P 500 ETF", ltv: 0.55, liq: 0.7, px: 588.4, gap: 0.05, sector: "Index ETF" },
  QQQ: { name: "Invesco QQQ Trust", ltv: 0.5, liq: 0.65, px: 511.92, gap: 0.07, sector: "Index ETF" },
};
type AssetKey = keyof typeof ASSETS;

function zoneOf(hf: number): Zone {
  if (hf >= 1.2) return { k: "safe", lbl: "Safe", col: "var(--safe)", wash: "var(--safe-wash)" };
  if (hf >= 1.0) return { k: "warn", lbl: "Warning", col: "var(--warn)", wash: "var(--warn-wash)" };
  return { k: "danger", lbl: "Danger · liquidatable", col: "var(--danger)", wash: "var(--danger-wash)" };
}
function hfMarkerPos(hf: number): number {
  if (hf < 1) return Math.max(2, (hf / 1.0) * 18);
  if (hf < 1.2) return 18 + ((hf - 1) / 0.2) * 20;
  return Math.min(98, 38 + ((hf - 1.2) / 1.2) * 60);
}
const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

function nyseState(): { s: string; open: boolean } {
  try {
    const parts: Record<string, string> = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .forEach((p) => (parts[p.type] = p.value));
    const mins = parseInt(parts.hour ?? "0", 10) * 60 + parseInt(parts.minute ?? "0", 10);
    if (parts.weekday === "Sat" || parts.weekday === "Sun") return { s: "Closed", open: false };
    if (mins >= 570 && mins < 960) return { s: "NYSE Open", open: true };
    if (mins >= 240 && mins < 570) return { s: "Pre-market", open: false };
    if (mins >= 960 && mins < 1200) return { s: "After-hours", open: false };
    return { s: "Closed", open: false };
  } catch {
    return { s: "Closed", open: false };
  }
}

const TL_STEPS = [
  {
    cls: "monitor",
    title: "Monitoring TSLA position",
    time: "14:02 UTC",
    body: (
      <>
        Health factor <span className="hfb" style={{ color: "var(--safe)" }}>1.41</span> — comfortable headroom.
      </>
    ),
    hf: "1.41",
    col: "var(--safe)",
  },
  {
    cls: "alert",
    title: "Warning alert sent",
    time: "15:38 UTC",
    body: (
      <>
        &ldquo;TSLA is down 6% intraday. Your health factor is{" "}
        <span className="hfb" style={{ color: "var(--warn)" }}>1.18</span>. Consider repaying or adding collateral.&rdquo;
      </>
    ),
    hf: "1.18",
    col: "var(--warn)",
  },
  {
    cls: "repay",
    title: "Auto-repay executed",
    time: "15:41 UTC",
    body: (
      <>
        HF crossed your <span className="hfb">1.10</span> trigger. Tessera repaid{" "}
        <span className="hfb" style={{ color: "var(--blue)" }}>420.00 USDC</span> from your approved allowance.
      </>
    ),
    hf: "1.06",
    col: "var(--danger)",
  },
  {
    cls: "safe",
    title: "Position restored",
    time: "15:41 UTC",
    body: (
      <>
        Health factor back to <span className="hfb" style={{ color: "var(--safe)" }}>1.31</span>. No liquidation. Logged
        to your activity feed.
      </>
    ),
    hf: "1.31",
    col: "var(--safe)",
  },
];

const MARKETS = [
  { sym: "TSLA", gl: "TS", nm: "Tesla, Inc.", sector: "Consumer", px: 342.18, ltv: "40%", liq: "55%" },
  { sym: "AAPL", gl: "AA", nm: "Apple Inc.", sector: "Technology", px: 214.55, ltv: "50%", liq: "65%" },
  { sym: "NVDA", gl: "NV", nm: "NVIDIA Corp.", sector: "Technology", px: 131.26, ltv: "40%", liq: "55%" },
  { sym: "SPY", gl: "SP", nm: "SPDR S&P 500 ETF", sector: "Index ETF", px: 588.4, ltv: "55%", liq: "70%" },
  { sym: "QQQ", gl: "QQ", nm: "Invesco QQQ Trust", sector: "Index ETF", px: 511.92, ltv: "50%", liq: "65%" },
];

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function CountUp({
  target,
  dec = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  target: number;
  dec?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fmt = (v: number) =>
      prefix + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
    if (reduce) {
      el.textContent = fmt(target);
      return;
    }
    let raf = 0;
    let started = false;
    const run = () => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / 1400, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) raf = requestAnimationFrame(step);
        else el.textContent = fmt(target);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !started) {
            started = true;
            run();
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, dec, prefix, suffix]);
  return (
    <span ref={ref} className={`sv ${className}`.trim()}>
      {prefix}0{suffix}
    </span>
  );
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mkt, setMkt] = useState<{ s: string; open: boolean }>({ s: "—", open: false });

  // simulator state
  const [sym, setSym] = useState<AssetKey>("TSLA");
  const [col, setCol] = useState(24000);
  const [bor, setBor] = useState(9400);

  // timeline
  const [tlStep, setTlStep] = useState(0);
  const tlRef = useRef<HTMLDivElement>(null);

  // live protocol stats — read straight from the vault; no invented numbers
  const stats = useProtocolStats();
  const live = stats.deployed && !stats.loading;
  const apy = live ? `${(stats.supplyBps / 100).toFixed(2)}%` : "—";
  const apr = live ? `${(stats.borrowBps / 100).toFixed(2)}%` : "—";

  const a = ASSETS[sym];
  const maxBorrow = col * a.ltv;
  const hf = bor > 0 ? (col * a.liq) / bor : 9.99;
  const z = zoneOf(hf);
  const gapped = col * (1 - a.gap);
  const ghf = bor > 0 ? (gapped * a.liq) / bor : 9.99;
  const gz = zoneOf(ghf);
  const overLtv = bor > maxBorrow + 1;
  const capText = overLtv
    ? `Above the ${Math.round(a.ltv * 100)}% LTV limit for ${sym} — this borrow would be rejected.`
    : `Using ${((bor / col) * 100).toFixed(1)}% LTV of ${Math.round(a.ltv * 100)}% allowed on ${sym}.`;

  function pickAsset(next: AssetKey) {
    setSym(next);
    setBor(Math.round(col * ASSETS[next].ltv * 0.55));
  }

  // mosaic intro + nav scroll + market pill
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf1 = 0;
    let raf2 = 0;
    if (reduce) {
      setIntroDone(true);
    } else {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIntroDone(true));
      });
    }
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const paint = () => setMkt(nyseState());
    paint();
    const mi = setInterval(paint, 30000);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("scroll", onScroll);
      clearInterval(mi);
    };
  }, []);

  // reveal-on-scroll
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // timeline autoplay when scrolled into view
  const tlTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playTimeline = () => {
    tlTimers.current.forEach(clearTimeout);
    tlTimers.current = [];
    setTlStep(0);
    TL_STEPS.forEach((_, i) => {
      tlTimers.current.push(setTimeout(() => setTlStep(i + 1), 700 + i * 1300));
    });
  };
  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    let played = false;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !played) {
            played = true;
            playTimeline();
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    const timers = tlTimers;
    return () => {
      io.disconnect();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const tlCur = tlStep > 0 ? TL_STEPS[tlStep - 1] : undefined;
  const tlHf = tlCur?.hf ?? "1.41";
  const tlCol = tlCur?.col ?? "var(--safe)";

  return (
    <div className="tsa" ref={rootRef}>
      {/* ============ NAV ============ */}
      <div className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="wrap nav-in">
          <Link className="brand" href="/">
            <Mark size={24} />
            <span className="wm">Tessera</span>
          </Link>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#agent">AI protection</a>
            <a href="#markets">Markets</a>
            <a href="#risk">Risk</a>
          </nav>
          <div className="nav-right">
            <span className={`mkt${mkt.open ? " open" : ""}`}>
              <span className="pulse" />
              <span>{mkt.s}</span>
            </span>
            <Link className="lbtn primary" href="/dashboard">
              Connect wallet
            </Link>
          </div>
        </div>
      </div>

      <main id="top">
        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="hero-tag">
                <Mark size={13} color="var(--blue)" /> <b>No token, ever.</b> &nbsp;Just yield and credit.
              </span>
              <h1>
                Borrow against your
                <br />
                tokenized stocks.
                <br />
                <span className="grad">Watched 24/7.</span>
              </h1>
              <p className="hsub">
                Tessera is the safest venue to lend USDC, or borrow against tokenized TSLA, AAPL, NVDA, SPY and QQQ. An
                AI agent monitors every position around the clock — and acts before a liquidation, not after.
              </p>
              <div className="hero-cta">
                <Link className="lbtn brand lg arrow" href="/borrow">
                  I want to borrow {ARROW}
                </Link>
                <a className="lbtn ghost lg" href="#how">
                  See how it works
                </a>
              </div>
              <div className="hero-note">
                <span className="it">{CHECK} Non-custodial</span>
                <span className="it">{CHECK} Chainlink oracles</span>
                <span className="it">{CHECK} Every action public</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="mosaic-stage">
                <div className={`mosaic${introDone ? "" : " intro"}`}>
                  {[
                    "",
                    "ink:TSLA",
                    "",
                    "",
                    ":NVDA",
                    "blue:SPY",
                    "",
                    "ink:AAPL",
                    "",
                    "",
                    ":QQQ",
                    "ink:",
                    "blue:",
                    "",
                    "",
                    "",
                  ].map((spec, i) => {
                    const [kind, tk] = spec.split(":");
                    return (
                      <div key={i} className={`mtile${kind ? " " + kind : ""}`}>
                        {tk ? <span className="tk">{tk}</span> : null}
                      </div>
                    );
                  })}
                </div>
                <div className="float-card" style={{ top: "-18px", right: "-6px" }}>
                  <span className="l">Supply APY</span>
                  <span className="v" style={{ color: "var(--safe)" }}>{apy}</span>
                </div>
                <div className="float-card" style={{ bottom: "6px", left: "-22px" }}>
                  <span className="l">Health factor</span>
                  <span className="v" style={{ color: "var(--safe)" }}>1.94</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LIVE STATS ============ */}
        <section className="stats">
          <div className="wrap">
            <div className="stats-in">
              <div className="stat">
                <span className="sl">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--safe)" strokeWidth="2.4">
                    <path d="M3 17l5-5 4 3 6-7" />
                  </svg>{" "}
                  Supply APY
                </span>
                {live ? (
                  <CountUp target={stats.supplyBps / 100} dec={2} suffix="%" className="safe" />
                ) : (
                  <span className="sv safe">—</span>
                )}
                <span className="sm">Variable · paid by borrowers</span>
              </div>
              <div className="stat">
                <span className="sl">Total value locked</span>
                <span className="sv">{live ? formatUsdcUsd(stats.tvlUsdc, { compact: true }) : "—"}</span>
                <span className="sm">USDC supplied to the pool</span>
              </div>
              <div className="stat">
                <span className="sl">Total borrows</span>
                <span className="sv">{live ? formatUsdcUsd(stats.borrowsUsdc, { compact: true }) : "—"}</span>
                <span className="sm">Outstanding against collateral</span>
              </div>
              <div className="stat">
                <span className="sl">Utilization</span>
                {live ? (
                  <CountUp target={stats.utilBps / 100} dec={1} suffix="%" />
                ) : (
                  <span className="sv">—</span>
                )}
                <span className="sm">
                  {live
                    ? `${stats.listedAssets} tokenized ${stats.listedAssets === 1 ? "equity" : "equities"} supported`
                    : "Live from the vault"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TWO PATHS ============ */}
        <section className="sec" id="start">
          <div className="wrap">
            <span className="eyebrow reveal">Two ways in</span>
            <h2 className="sec-h reveal">
              Put idle USDC to work,
              <br />
              or unlock cash from your stocks.
            </h2>
            <div className="paths">
              <div className="path lend reveal">
                <div className="pic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M3 17l5-5 4 3 6-7" />
                    <path d="M16 8h4v4" />
                  </svg>
                </div>
                <h3>Lend USDC</h3>
                <p>
                  Deposit into a single pool and earn variable yield from borrowers&apos; interest. Withdraw whenever the
                  pool has liquidity.
                </p>
                <div className="rate">
                  <b>{apy}</b> <span style={{ color: "var(--muted)" }}>current supply APY</span>
                </div>
                <Link className="plink" href="/lend">
                  Start lending {ARROW}
                </Link>
              </div>
              <div className="path borrow reveal">
                <div className="pic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <h3>Borrow against collateral</h3>
                <p>
                  Pledge tokenized equities as collateral and borrow USDC against them — keep your upside, get
                  liquidity, and let the agent guard your health factor.
                </p>
                <div className="rate">
                  <b style={{ color: "var(--blue)" }}>{apr}</b>{" "}
                  <span style={{ color: "var(--muted)" }}>current borrow APR</span>
                </div>
                <a className="plink" href="#how">
                  See the borrow flow {ARROW}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ============ SIMULATOR ============ */}
        <section className="sec tight" id="how">
          <div className="wrap">
            <span className="eyebrow reveal">Learn by doing</span>
            <h2 className="sec-h reveal">
              Your <em>health factor</em> is the whole game.
            </h2>
            <p className="sec-sub reveal">
              Borrow too much against your collateral and your health factor falls. Below{" "}
              <span className="mono">1.00</span>, your position can be liquidated. Drag the sliders to feel exactly how
              it moves — this is the same math the contract runs.
            </p>

            <div className="sim reveal" style={{ marginTop: 44 }}>
              <div className="sim-inner">
                <div className="sim-controls">
                  <div className="asset-tabs">
                    {(Object.keys(ASSETS) as AssetKey[]).map((s) => (
                      <button key={s} className={`atab${s === sym ? " active" : ""}`} onClick={() => pickAsset(s)}>
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="sld-group">
                    <div className="sld-top">
                      <span className="lab">Collateral deposited</span>
                      <span className="num">{usd(col)}</span>
                    </div>
                    <input
                      type="range"
                      min={2000}
                      max={60000}
                      step={500}
                      value={col}
                      onChange={(e) => setCol(parseFloat(e.target.value))}
                      aria-label="Collateral value"
                    />
                    <div className="sld-meta">
                      <span>$2,000</span>
                      <span>$60,000</span>
                    </div>
                  </div>

                  <div className="sld-group">
                    <div className="sld-top">
                      <span className="lab">USDC borrowed</span>
                      <span className="num">{usd(bor)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40000}
                      step={200}
                      value={bor}
                      onChange={(e) => setBor(parseFloat(e.target.value))}
                      aria-label="Borrow amount"
                    />
                    <div className="sld-meta">
                      <span>$0</span>
                      <span>$40,000</span>
                    </div>
                    <div className="sld-cap">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v5" />
                      </svg>{" "}
                      Max borrow at this collateral: <b>{usd(maxBorrow)}</b>
                    </div>
                  </div>

                  <p
                    className="mono"
                    style={{ fontSize: 12.5, color: overLtv ? "var(--danger)" : "var(--muted)", marginTop: 18, lineHeight: 1.5 }}
                  >
                    {capText}
                  </p>
                </div>

                <div className="sim-result">
                  <span className="res-zone" style={{ background: z.wash, color: z.col }}>
                    <span className="d" style={{ background: z.col }} />
                    <span>{z.lbl}</span>
                  </span>
                  <div className="res-hf" style={{ color: z.col }}>
                    {hf >= 9.99 ? "∞" : hf.toFixed(2)}
                  </div>
                  <span className="res-cap">
                    Health factor — <span className="mono">(collateral × liq. threshold) ÷ debt</span>
                  </span>

                  <div className="hf-track">
                    <div className="hf-marker" style={{ left: hfMarkerPos(Math.min(hf, 2.4)) + "%" }} />
                  </div>
                  <div className="hf-scale">
                    <span>0.60</span>
                    <span>1.00 liq.</span>
                    <span>1.20</span>
                    <span>2.40+</span>
                  </div>

                  <div className="gap-box">
                    <div className="gt">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2">
                        <path d="M12 3l9 16H3z" />
                        <path d="M12 10v4" />
                      </svg>{" "}
                      Weekend gap risk
                    </div>
                    <p className="gp">
                      If <span className="hfx" style={{ color: "var(--ink)" }}>{sym}</span> gaps{" "}
                      <span className="hfx" style={{ color: "var(--warn)" }}>{Math.round(a.gap * 100)}%</span> down before
                      markets reopen, your health factor becomes{" "}
                      <span className="hfx" style={{ color: gz.col }}>{ghf >= 9.99 ? "∞" : ghf.toFixed(2)}</span>. This is
                      why LTVs stay conservative.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ AI AGENT ============ */}
        <section className="sec" id="agent">
          <div className="wrap">
            <span className="eyebrow reveal">The safety net</span>
            <h2 className="sec-h reveal">
              An agent that watches,
              <br />
              warns, and repays for you.
            </h2>
            <p className="sec-sub reveal">
              When your health factor drifts toward danger, the agent sends a plain-English alert. If you&apos;ve turned
              on Active Protection, it repays from your pre-approved USDC to pull you back to safety — automatically.
              Watch a real sequence:
            </p>

            <div className="agent-wrap" style={{ marginTop: 48 }}>
              <div className="timeline reveal" ref={tlRef}>
                <div className="tl-head">
                  <span className="ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>{" "}
                    Active Protection
                  </span>
                  <button className="tl-replay" onClick={playTimeline}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                      <path d="M3 4v4h4" />
                    </svg>{" "}
                    Replay
                  </button>
                </div>
                <div className="tl-body">
                  {TL_STEPS.map((step, i) => (
                    <div key={i} className={`tl-row ${step.cls}${tlStep > i ? " on" : ""}`}>
                      <div className="dot">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          {step.cls === "monitor" && (
                            <>
                              <circle cx="11" cy="11" r="7" />
                              <path d="M21 21l-4-4" />
                            </>
                          )}
                          {step.cls === "alert" && (
                            <>
                              <path d="M12 3l9 16H3z" />
                              <path d="M12 9v4" />
                            </>
                          )}
                          {step.cls === "repay" && (
                            <>
                              <path d="M3 12a9 9 0 1 1 9 9" />
                              <path d="M3 8v4h4" />
                              <path d="M12 8v4l3 2" />
                            </>
                          )}
                          {step.cls === "safe" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
                        </svg>
                      </div>
                      <div className="tc">
                        <div className="tt">
                          {step.title} <span className="tm">{step.time}</span>
                        </div>
                        <div className="td">{step.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="tl-hf">
                  <span className="lab">Live health factor</span>
                  <span className="v" style={{ color: tlCol }}>{tlHf}</span>
                </div>
              </div>

              <div className="agent-points">
                <div className="apoint reveal">
                  <div className="ab">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4>It watches, every block</h4>
                    <p>
                      The agent reads your health factor on a constant loop — through nights, weekends, and market
                      closures, when stocks can gap.
                    </p>
                  </div>
                </div>
                <div className="apoint reveal">
                  <div className="ab">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 4h16v12H7l-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4>It explains in plain English</h4>
                    <p>
                      Alerts arrive on Telegram, Discord, or email — written to be understood, never to alarm. The same
                      copy lands in your activity feed.
                    </p>
                  </div>
                </div>
                <div className="apoint reveal">
                  <div className="ab">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 12a9 9 0 1 1 9 9" />
                      <path d="M3 8v4h4" />
                    </svg>
                  </div>
                  <div>
                    <h4>It repays only what you allow</h4>
                    <p>
                      Auto-repay is opt-in, capped per transaction and per day, and pulls only from the USDC allowance
                      you signed. Nothing more.
                    </p>
                  </div>
                </div>
                <div className="killnote reveal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  <span>
                    One <b>kill switch</b> disables the agent for your positions instantly — it zeros the allowance and
                    stops every action on your behalf.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ MARKETS ============ */}
        <section className="sec tight" id="markets">
          <div className="wrap">
            <span className="eyebrow reveal">Supported collateral</span>
            <h2 className="sec-h reveal">Five blue-chips. Conservative by design.</h2>
            <p className="sec-sub reveal">
              Every asset has its own loan-to-value and liquidation threshold, set to survive the gaps that stocks take
              overnight and on Mondays. Prices come from Chainlink oracles.
            </p>
            <div className="mkt-grid">
              {MARKETS.map((m) => (
                <div className="mcard reveal" key={m.sym}>
                  <div className="mh">
                    <div className="gl">{m.gl}</div>
                    <span className="ut">{m.sector}</span>
                  </div>
                  <div className="tk">{m.sym}</div>
                  <div className="nm">{m.nm}</div>
                  <div className="px">${m.px.toFixed(2)}</div>
                  <div className="row">
                    <span className="k">LTV</span>
                    <span className="v">{m.ltv}</span>
                  </div>
                  <div className="row" style={{ borderTop: 0, paddingTop: 6 }}>
                    <span className="k">Liq. threshold</span>
                    <span className="v">{m.liq}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ GAP RISK ============ */}
        <section className="sec gap-sec" id="risk">
          <div className="wrap gap-grid">
            <div className="gap-text">
              <span className="eyebrow reveal">Why so conservative</span>
              <h2 className="sec-h reveal">
                Tokens trade 24/7.
                <br />
                The stock behind them doesn&apos;t.
              </h2>
              <p className="sec-sub reveal">
                Tokenized stocks settle on-chain at all hours, but the underlying share price only updates when the
                market is open. Over a weekend or on bad news, a stock can <em>gap</em> — open far below Friday&apos;s
                close. That jump is the real risk, and it&apos;s why Tessera&apos;s loan-to-value limits leave room to
                absorb it.
              </p>
              <div className="hero-note reveal" style={{ marginTop: 24 }}>
                <span className="it">{CHECK} LTVs sized for overnight gaps</span>
                <span className="it">{CHECK} Agent acts through the gap</span>
              </div>
            </div>
            <div className="gap-chart reveal">
              <svg viewBox="0 0 420 240" role="img" aria-label="A stock price gapping down over a weekend">
                <line x1="40" y1="40" x2="40" y2="190" stroke="var(--line-2)" strokeWidth="1" />
                <line x1="40" y1="190" x2="400" y2="190" stroke="var(--line-2)" strokeWidth="1" />
                <polyline
                  points="48,120 90,108 130,116 170,96 205,104"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="205" cy="104" r="4" fill="var(--ink)" />
                <rect x="205" y="40" width="58" height="150" fill="var(--warn-wash)" />
                <text x="234" y="58" textAnchor="middle" className="glabel" fill="var(--warn)">
                  WEEKEND
                </text>
                <line
                  x1="205"
                  y1="104"
                  x2="263"
                  y2="158"
                  stroke="var(--danger)"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
                <circle cx="263" cy="158" r="4" fill="var(--danger)" />
                <polyline
                  points="263,158 300,150 340,162 380,150"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text x="120" y="210" textAnchor="middle" className="glabel">
                  Fri close
                </text>
                <text x="320" y="210" textAnchor="middle" className="glabel">
                  Mon open
                </text>
                <text x="278" y="142" className="glabel" fill="var(--danger)">
                  −15% gap
                </text>
              </svg>
            </div>
          </div>
        </section>

        {/* ============ PILLARS ============ */}
        <section className="sec">
          <div className="wrap">
            <span className="eyebrow reveal">What we won&apos;t do</span>
            <h2 className="sec-h reveal">Credibility over incentives.</h2>
            <div className="pillars">
              <div className="pill reveal">
                <div className="pi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M5.6 5.6l12.8 12.8" />
                  </svg>
                </div>
                <h3>No token, ever</h3>
                <p>
                  No airdrops, no points, no governance coin, no fee tiers. There is nothing to farm here — only yield
                  and credit. We will never imply otherwise.
                </p>
              </div>
              <div className="pill reveal">
                <div className="pi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  </svg>
                </div>
                <h3>No custody</h3>
                <p>
                  Tessera never holds your funds. The smart contract does. The agent acts only through permissioned
                  entrypoints and the approvals you sign.
                </p>
              </div>
              <div className="pill reveal">
                <div className="pi">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3>Radical transparency</h3>
                <p>
                  Every liquidation, every agent action, every parameter change is visible in-app — with the multisig
                  transaction and the rationale behind it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="sec tight">
          <div className="wrap">
            <div className="cta reveal">
              <div className="cta-mosaic" />
              <div style={{ position: "relative" }}>
                <h2>
                  Lend, borrow, and sleep
                  <br />
                  through the weekend.
                </h2>
                <p>Connect a wallet to see live rates. Non-custodial, geo-compliant, and watched around the clock.</p>
                <div className="cta-btns">
                  <Link className="lbtn primary lg" href="/lend">
                    I want to lend
                  </Link>
                  <Link className="lbtn ghost lg arrow" href="/borrow">
                    I want to borrow {ARROW}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="lfoot">
          <div className="wrap">
            <div className="foot-top">
              <div className="foot-brand">
                <Link className="brand" href="/" style={{ textDecoration: "none" }}>
                  <Mark size={22} />
                  <span className="wm">Tessera</span>
                </Link>
                <p>
                  Autonomous financial infrastructure for 24/7 tokenized equity markets. Not available in the US or
                  sanctioned jurisdictions.
                </p>
                <span className="notoken" style={{ marginTop: 16 }}>
                  {CHECK} No token, ever
                </span>
              </div>
              <div className="foot-cols">
                <div className="fcol">
                  <h5>Protocol</h5>
                  <a href="#markets">Markets</a>
                  <a href="#risk">Risk</a>
                  <Link href="/transparency">Transparency</Link>
                  <Link href="/status">Status</Link>
                </div>
                <div className="fcol">
                  <h5>Learn</h5>
                  <a href="#how">How it works</a>
                  <a href="#agent">AI protection</a>
                  <Link href="/dashboard">Dashboard</Link>
                </div>
                <div className="fcol">
                  <h5>App</h5>
                  <Link href="/lend">Lend</Link>
                  <Link href="/borrow">Borrow</Link>
                  <Link href="/agent">Activity</Link>
                </div>
              </div>
            </div>
            <div className="foot-bot">
              <span className="mono">© 2026 Tessera · Built on Robinhood Chain &amp; Arbitrum</span>
              <span className="mono">Testnet · Arbitrum Sepolia · No token, ever</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
