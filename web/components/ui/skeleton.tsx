/** Loading placeholder that mirrors the shape of the data it stands in for. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "inline-block animate-pulse rounded-md bg-[color:var(--color-muted)] align-middle " + className
      }
    />
  );
}
