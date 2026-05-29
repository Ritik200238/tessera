import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn-shape Button (slim variant — we don't ship every variant from the
 * registry, only the subset we use).
 */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:opacity-90",
  secondary:
    "bg-[color:var(--color-secondary)] text-[color:var(--color-secondary-foreground)] hover:opacity-90",
  outline:
    "border border-[color:var(--color-border)] bg-transparent hover:bg-[color:var(--color-muted)]",
  ghost: "hover:bg-[color:var(--color-muted)]",
  destructive:
    "bg-[color:var(--color-destructive)] text-[color:var(--color-destructive-foreground)] hover:opacity-90",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
});
