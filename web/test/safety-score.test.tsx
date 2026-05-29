import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SafetyScore } from "@/components/safety-score";

const E18 = 1_000_000_000_000_000_000n;

describe("<SafetyScore/>", () => {
  it("renders 100 at hf = 2e18", () => {
    render(<SafetyScore hf={2n * E18} />);
    expect(screen.getByLabelText(/Safety score 100 out of 100/)).toBeInTheDocument();
    expect(screen.getByText(/Safe/)).toBeInTheDocument();
  });
  it("renders 75 at hf = 1.5e18", () => {
    render(<SafetyScore hf={1_500_000_000_000_000_000n} />);
    expect(screen.getByLabelText(/Safety score 75 out of 100/)).toBeInTheDocument();
  });
  it("classifies at-risk between 1.0 and 1.1", () => {
    render(<SafetyScore hf={1_050_000_000_000_000_000n} />);
    expect(screen.getByText(/At risk/)).toBeInTheDocument();
  });
  it("classifies liquidating under 1e18", () => {
    render(<SafetyScore hf={950_000_000_000_000_000n} />);
    expect(screen.getByText(/Liquidating/)).toBeInTheDocument();
  });
  it("renders the advisory copy", () => {
    render(<SafetyScore hf={2n * E18} />);
    expect(screen.getByText(/Tessera is watching/)).toBeInTheDocument();
  });
});
