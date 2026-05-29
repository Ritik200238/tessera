import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthBadge } from "@/components/health-badge";
import type { HealthTone } from "@/lib/health";

const cases: { tone: HealthTone; label: string }[] = [
  { tone: "safe", label: "Safe" },
  { tone: "healthy", label: "Healthy" },
  { tone: "watch", label: "Watch" },
  { tone: "atrisk", label: "At risk" },
  { tone: "liquidating", label: "Liquidating" },
];

describe("<HealthBadge/>", () => {
  for (const c of cases) {
    it(`renders ${c.tone} with aria label, label text, and an icon`, () => {
      const { container } = render(<HealthBadge tone={c.tone} label={c.label} />);
      const el = screen.getByRole("status");
      expect(el).toHaveAttribute("aria-label", `Position status: ${c.label}`);
      expect(el).toHaveAttribute("data-tone", c.tone);
      expect(el.textContent).toContain(c.label);
      // The icon is the only <svg> child; presence verifies the colour-blind
      // accessibility pairing (TDD R2).
      expect(container.querySelector("svg")).not.toBeNull();
    });
  }
  it("supports size variants without affecting the label", () => {
    render(<HealthBadge tone="safe" label="Safe" size="lg" />);
    expect(screen.getByRole("status").textContent).toContain("Safe");
  });
});
