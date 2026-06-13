"use client";

import { useEffect, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";

type Status = "idle" | "submitting" | "done" | "already" | "error";

/**
 * Early-access capture. Posts to the agent-backed waitlist via /api/waitlist and
 * shows the REAL signup count (or "Be the first" when it's zero) — never a
 * fabricated number. Used on /why and the landing.
 */
export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/waitlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j && typeof j.count === "number") setCount(j.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, useCase }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; added?: boolean; count?: number; error?: string };
      if (!r.ok || !j.ok) {
        setStatus("error");
        setError(j.error ?? "Something went wrong — try again.");
        return;
      }
      if (typeof j.count === "number") setCount(j.count);
      setStatus(j.added ? "done" : "already");
      track("waitlist_signup", { added: !!j.added, with_use_case: !!useCase.trim() });
    } catch {
      setStatus("error");
      setError("Couldn't reach the list — try again in a moment.");
    }
  }

  if (status === "done" || status === "already") {
    return (
      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted)] px-4 py-3 text-sm">
        <p className="font-medium text-[color:var(--color-safe-fg)]">
          {status === "done" ? "You're on the list." : "You're already on the list."}
        </p>
        <p className="text-[color:var(--color-muted-foreground)]">
          We&apos;ll email you the moment early access opens — nothing else.
          {count !== null && count > 0 ? ` You're one of ${count.toLocaleString()}.` : ""}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className={"flex gap-2 " + (compact ? "" : "flex-col sm:flex-row")}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="you@email.com"
          aria-label="Email for early access"
          className="h-11 flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-11 shrink-0 rounded-md bg-[color:var(--color-primary)] px-5 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {status === "submitting" ? "Joining…" : "Get early access"}
        </button>
      </div>
      {!compact ? (
        <input
          type="text"
          value={useCase}
          onChange={(e) => setUseCase(e.currentTarget.value)}
          maxLength={500}
          placeholder="What would you borrow against, and why? (optional)"
          aria-label="What would you borrow against (optional)"
          className="h-11 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      ) : null}
      <p className="text-xs text-[color:var(--color-muted-foreground)]">
        {error ? (
          <span className="text-[color:var(--color-liquidating-fg)]">{error}</span>
        ) : count !== null && count > 0 ? (
          `${count.toLocaleString()} on the early-access list. No spam, no token, one email when it opens.`
        ) : (
          "Be the first on the early-access list. No spam, no token, one email when it opens."
        )}
      </p>
    </form>
  );
}
