import { calculateHealthScore, calculateMomentum, getHealthLabel } from "./scoring";
import { companies } from "./data";
import { describe, expect, it } from "vitest";

describe("health scoring", () => {
  it("uses transparent weighted components", () => {
    expect(calculateHealthScore([
      { label: "Growth", score: 90, weight: 60, trend: "up" },
      { label: "Value", score: 60, weight: 40, trend: "flat" },
    ])).toBe(78);
  });

  it("maps scores to investor-friendly labels", () => {
    expect(getHealthLabel(92)).toBe("Excellent");
    expect(getHealthLabel(80)).toBe("Healthy");
    expect(getHealthLabel(70)).toBe("Watch");
    expect(getHealthLabel(54)).toBe("Needs review");
  });

  it("keeps every displayed fixture score aligned with its visible components", () => {
    expect(companies.map((company) => [company.symbol, calculateHealthScore(company.healthComponents)]))
      .toEqual(companies.map((company) => [company.symbol, company.health]));
  });
});

describe("momentum scoring", () => {
  it("weights the multi-period trend", () => {
    const result = calculateMomentum([
      { label: "1 month", shortLabel: "1M", returnPct: 4, sparkline: [] },
      { label: "3 months", shortLabel: "3M", returnPct: 9, sparkline: [] },
      { label: "6 months", shortLabel: "6M", returnPct: 14, sparkline: [] },
      { label: "1 year", shortLabel: "1Y", returnPct: 20, sparkline: [] },
    ]);
    expect(result.score).toBeGreaterThan(70);
    expect(result.label).toMatch(/uptrend/i);
  });
});
