/**
 * Privacy-first product analytics. No PII, no fingerprinting, no cookies — a thin
 * wrapper over a Plausible/Umami-compatible `window.plausible(event, {props})`.
 *
 * Activates only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set (the script is injected
 * in layout.tsx); otherwise every call is a safe no-op. This matches the no-KYC,
 * "we collect almost nothing" posture in the blueprint.
 *
 * Funnel events: landing_cta_click -> wallet_connected -> first_action -> protection_enabled.
 */

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Props }) => void;
  }
}

export function track(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the app */
  }
}
