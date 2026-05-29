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
      status: "submitted" | "confirmed" | "reverted";
    }
  | { ts: string; kind: "error"; where: string; message: string };

const KIND_LABEL: Record<AgentAction["kind"], string> = {
  tick: "Tick",
  alert: "Alert",
  liquidate: "Liquidate",
  error: "Error",
};

export function ActionLog({ actions }: { actions: AgentAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
        No agent actions recorded yet. Once the agent starts ticking, entries will appear here in
        real time.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
      <table className="w-full text-sm">
        <caption className="sr-only">Most recent agent actions</caption>
        <thead className="bg-[color:var(--color-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">When</th>
            <th scope="col" className="px-3 py-2 font-medium">Kind</th>
            <th scope="col" className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr
              key={`${a.ts}-${i}`}
              className={cn("border-t border-[color:var(--color-border)]", rowTone(a))}
            >
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                {formatTs(a.ts)}
              </td>
              <td className="px-3 py-2">
                <span className="font-medium">{KIND_LABEL[a.kind]}</span>
              </td>
              <td className="px-3 py-2">{renderDetail(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
