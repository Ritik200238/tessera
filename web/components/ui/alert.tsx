import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success";

const TONE: Record<Tone, string> = {
  info: "bg-[color:var(--color-muted)] text-[color:var(--color-foreground)] border-[color:var(--color-border)]",
  warning:
    "bg-[color:var(--color-watch-bg)] text-[color:var(--color-watch-fg)] border-[color:var(--color-watch-fg)]/30",
  danger:
    "bg-[color:var(--color-liquidating-bg)] text-[color:var(--color-liquidating-fg)] border-[color:var(--color-liquidating-fg)]/30",
  success:
    "bg-[color:var(--color-safe-bg)] text-[color:var(--color-safe-fg)] border-[color:var(--color-safe-fg)]/30",
};

export function Alert({
  tone = "info",
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div role="alert" className={cn("rounded-md border px-4 py-3 text-sm", TONE[tone], className)} {...rest} />;
}

export function AlertTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold", className)} {...rest} />;
}

export function AlertDescription({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm opacity-90", className)} {...rest} />;
}
