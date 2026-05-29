/**
 * Tessera mark — four tesserae (mosaic tiles) set with grout gaps. Three sit in
 * neutral ink (via currentColor), one is laid in Tessera Blue: the moment a
 * position joins the structure. From the Brand Kit (§02 Logo).
 *
 * Color comes from `color` (default ink). On dark surfaces pass color="#fff";
 * the bottom-right tile is always blue.
 */
export function Mark({
  size = 22,
  color = "var(--ink)",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      style={{ color }}
      aria-hidden
    >
      <rect x="4" y="4" width="18" height="18" rx="3.5" fill="currentColor" opacity=".92" />
      <rect x="26" y="4" width="18" height="18" rx="3.5" fill="currentColor" opacity=".42" />
      <rect x="4" y="26" width="18" height="18" rx="3.5" fill="currentColor" opacity=".42" />
      <rect x="26" y="26" width="18" height="18" rx="3.5" fill="var(--blue)" />
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function Wordmark({
  markSize = 22,
  color = "var(--ink)",
  className,
}: {
  markSize?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 11, color }}
    >
      <Mark size={markSize} color={color} />
      <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.025em" }}>Tessera</span>
    </span>
  );
}
