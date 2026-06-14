"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchEntry } from "@/lib/docs";

/** The visible search box. Multiple triggers can share one palette. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:border-[color:var(--color-primary)]"
    >
      <Search aria-hidden className="size-4" />
      <span className="flex-1 text-left">Search docs…</span>
      <kbd className="hidden rounded border border-[color:var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

interface Result {
  title: string;
  context: string;
  href: string;
  kind: "page" | "heading";
}

function buildResults(entries: SearchEntry[], q: string): Result[] {
  const query = q.trim().toLowerCase();
  const out: Result[] = [];
  for (const e of entries) {
    if (!query || e.title.toLowerCase().includes(query) || e.groupTitle.toLowerCase().includes(query)) {
      out.push({ title: e.title, context: e.groupTitle, href: `/docs/${e.slug}`, kind: "page" });
    }
    if (query) {
      for (const h of e.headings) {
        if (h.text.toLowerCase().includes(query)) {
          out.push({ title: h.text, context: e.title, href: `/docs/${e.slug}#${h.slug}`, kind: "heading" });
        }
      }
    }
    if (out.length >= 30) break;
  }
  return out.slice(0, 30);
}

/**
 * The Cmd-K command palette. Mounted ONCE (always present so the keyboard
 * shortcut works); `open` is controlled by the parent so any number of
 * SearchTriggers can open it.
 */
export function SearchPalette({
  entries,
  open,
  onOpen,
  onClose,
}: {
  entries: SearchEntry[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => buildResults(entries, query), [entries, query]);

  // Cmd/Ctrl+K opens it — listener is always mounted (onOpen is stable).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen]);

  // On open: reset, focus, lock background scroll (restored on close).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(r: Result | undefined) {
    if (!r) return;
    onClose();
    router.push(r.href);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-4">
          <Search aria-hidden className="size-4 text-[color:var(--color-muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the docs…"
            className="h-12 flex-1 bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
          />
          <kbd className="rounded border border-[color:var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-[color:var(--color-muted-foreground)]">
              No matches for &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.href + i}>
                <button
                  type="button"
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                  className={
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors " +
                    (active === i
                      ? "bg-[color:var(--blue-wash)] text-[color:var(--color-primary)]"
                      : "text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]")
                  }
                >
                  <span className="truncate">
                    {r.kind === "heading" ? (
                      <span className="text-[color:var(--color-muted-foreground)]">{r.context} › </span>
                    ) : null}
                    {r.title}
                  </span>
                  <span className="shrink-0 text-xs text-[color:var(--color-muted-foreground)]">
                    {r.kind === "page" ? r.context : "section"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
