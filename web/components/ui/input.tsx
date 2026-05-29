import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-md border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-3 py-2 text-sm",
          "placeholder:text-[color:var(--color-muted-foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...rest}
      />
    );
  },
);
