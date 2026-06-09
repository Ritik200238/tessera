import { cn } from "@/lib/utils";

/**
 * Agent action log — TDD §4.7. Rendered as a semantic table for screen
 * reader friendliness. Server component: parents fetch and pass actions.
 */

export type AgentAction =
  | { ts: string; kind: "tick"; usersChecked: number; durationMs: number }
  | { ts: string; kind: "alert"; user: string; hf: string; copy: string }
  | {
      ts: string;
      kind: "liquidate";
      user: string;
      tx: string;
      repay: string;
      seized: string;
      token: string;
      status: "simulated" | "submitted" | "confirmed" | "reverted" | "skipped";
    }
  | {
      ts: string;
      kind: "auto_repay";
      user: string;
      tx: string;
      repay: string;
      hfBefore: string;
      status: "submitted" | "confirmed" | "reverted" | "skipped";
      rationale?: string;
      reason?: string;
    }
  | { ts: string; kind: "error"; where: string; message: string };

const KIND_LABEL: Record<AgentAction["kind"], string> = {
  tick: "Tick",
  alert: "Alert",
  auto_repay: "Auto-repay",
  liquidate: "Liquidate",
  error: "Error",
};

export function ActionLog({ actions }: { actions: AgentAction[] }) {
  // De-noise: the agent ticks every block, so raw feeds are a wall of "Tick"
  // heartbeats. Collapse them into one "last checked" pulse and surface only the
  // substantive events (alerts / auto-repays / liquidations / errors).
  const substantive = actions.filter((a) => a.kind !== "tick");
  const latestTick = actions.find((a) => a.kind === "tick") as
    | Extract<AgentAction, { kind: "tick" }>
    | undefined;

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
        No agent actions recorded yet. Once the agent starts ticking, entries will appear here in
        real time.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {latestTick ? (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-3 py-2 text-xs text-[color:var(--color-muted-foreground)]">
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: "var(--color-safe-fg)" }} />
          <span>
            Monitoring every block — last checked{" "}
            <span className="font-mono">{formatTs(latestTick.ts)}</span>
            {latestTick.usersChecked > 0
              ? ` · ${latestTick.usersChecked} position${latestTick.usersChecked === 1 ? "" : "s"}`
              : ""}
          </span>
        </div>
      ) : null}

      {substantive.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          No alerts or interventions needed recently — the agent is watching every block and will act
          (and log it here) the moment risk rises.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Recent agent alerts and interventions</caption>
            <thead className="bg-[color:var(--color-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">When</th>
                <th scope="col" className="px-3 py-2 font-medium">Kind</th>
                <th scope="col" className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {substantive.map((a, i) => (
                <tr
                  key={`${a.ts}-${i}`}
                  className={cn("border-t border-[color:var(--color-border)]", rowTone(a))}
                >
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatTs(a.ts)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{KIND_LABEL[a.kind]}</span>
                  </td>
                  <td className="px-3 py-2">{renderDetail(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderDetail(a: AgentAction): React.ReactNode {
  switch (a.kind) {
    case "tick":
      return (
        <span className="text-[color:var(--color-muted-foreground)]">
          Checked {a.usersChecked} users in {a.durationMs}ms
        </span>
      );
    case "alert":
      return (
        <>
          <code className="font-mono text-xs">{shortAddr(a.user)}</code> · HF {a.hf} ·{" "}
          <span>{a.copy}</span>
        </>
      );
    case "auto_repay":
      return (
        <>
          Protected <code className="font-mono text-xs">{shortAddr(a.user)}</code>: repaid{" "}
          <span className="font-medium">{(Number(a.repay) / 1e6).toLocaleString()} USDC</span> from
          their pre-approved funds to restore health (HF was {(Number(a.hfBefore) / 1e18).toFixed(2)})
          · <span className="uppercase text-xs">{a.status}</span>{" "}
          {a.tx && (a.status === "submitted" || a.status === "confirmed") ? (
            <code className="font-mono text-xs">{shortAddr(a.tx)}</code>
          ) : null}
          {a.rationale ? (
            <span className="mt-0.5 block text-xs text-[color:var(--color-muted-foreground)]">{a.rationale}</span>
          ) : null}
        </>
      );
    case "liquidate":
      return (
        <>
          <code className="font-mono text-xs">{shortAddr(a.user)}</code> repay {a.repay} →
          seized {a.seized} · <span className="uppercase text-xs">{a.status}</span>{" "}
          <code className="font-mono text-xs">{shortAddr(a.tx)}</code>
        </>
      );
    case "error":
      return (
        <span className="text-[color:var(--color-liquidating-fg)]">
          <strong>{a.where}:</strong> {a.message}
        </span>
      );
  }
}

function rowTone(a: AgentAction): string {
  switch (a.kind) {
    case "auto_repay":
      return "bg-[color:var(--color-brand-wash)]";
    case "liquidate":
      return "bg-[color:var(--color-atrisk-bg)]/20";
    case "alert":
      return "bg-[color:var(--color-watch-bg)]/20";
    case "error":
      return "bg-[color:var(--color-liquidating-bg)]/20";
    default:
      return "";
  }
}

function shortAddr(s: string): string {
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace("T", " ").slice(0, 19);
}
