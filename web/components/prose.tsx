import type { ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/**
 * Typed, zero-dependency long-form content renderer used by the litepaper, docs,
 * FAQ answers, and blog posts. Content is authored as an array of structured
 * blocks (see `Block`) rather than raw markdown/HTML, so rendering is fully
 * deterministic and safe (no markdown-parser edge cases, no dangerouslySetInnerHTML)
 * and the styling stays consistent with the design system.
 *
 * Inline emphasis inside text supports a tiny, safe subset: **bold**, `code`,
 * and [label](url).
 */
export type Block =
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "p"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "callout"; tone?: "info" | "warning" | "danger" | "success"; title?: string; body: string }
  | { type: "code"; code: string; lang?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "quote"; text: string }
  | { type: "divider" };

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      out.push(<strong key={key++} className="font-semibold text-[color:var(--color-foreground)]">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      out.push(
        <code key={key++} className="rounded bg-[color:var(--color-muted)] px-1 py-0.5 font-mono text-[0.85em]">
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined && m[5] !== undefined) {
      const href = m[5];
      const external = /^https?:/.test(href);
      out.push(
        <a
          key={key++}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80"
        >
          {m[4]}
          {external ? " ↗" : ""}
        </a>,
      );
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Stable slug for heading anchors (used by docs/FAQ TOCs). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.type) {
    case "h2":
      return (
        <h2 key={i} id={b.id ?? slugify(b.text)} className="scroll-mt-24 mt-10 text-2xl font-semibold tracking-tight text-[color:var(--color-foreground)] first:mt-0">
          {b.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} id={b.id ?? slugify(b.text)} className="scroll-mt-24 mt-8 text-lg font-semibold text-[color:var(--color-foreground)]">
          {b.text}
        </h3>
      );
    case "p":
      return (
        <p key={i} className="mt-4 leading-relaxed text-[color:var(--color-muted-foreground)]">
          {renderInline(b.text)}
        </p>
      );
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag key={i} className={"mt-4 space-y-2 pl-5 text-[color:var(--color-muted-foreground)] " + (b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((it, j) => (
            <li key={j} className="leading-relaxed">
              {renderInline(it)}
            </li>
          ))}
        </Tag>
      );
    }
    case "callout":
      return (
        <Alert key={i} tone={b.tone ?? "info"} className="mt-6">
          {b.title ? <AlertTitle>{b.title}</AlertTitle> : null}
          <AlertDescription>{renderInline(b.body)}</AlertDescription>
        </Alert>
      );
    case "code":
      return (
        <pre key={i} className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-4 text-xs leading-relaxed">
          <code className="font-mono">{b.code}</code>
        </pre>
      );
    case "table":
      return (
        <div key={i} className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-muted)] text-left">
              <tr>
                {b.headers.map((h, j) => (
                  <th key={j} className="px-3 py-2 font-semibold text-[color:var(--color-foreground)]">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r} className="border-t border-[color:var(--color-border)]">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 text-[color:var(--color-muted-foreground)]">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <blockquote key={i} className="mt-6 border-l-2 border-[color:var(--color-primary)] pl-4 italic text-[color:var(--color-muted-foreground)]">
          {renderInline(b.text)}
        </blockquote>
      );
    case "divider":
      return <hr key={i} className="my-10 border-[color:var(--color-border)]" />;
    default:
      return null;
  }
}

export function Prose({ blocks, className }: { blocks: Block[]; className?: string }) {
  return <div className={className}>{blocks.map((b, i) => renderBlock(b, i))}</div>;
}
