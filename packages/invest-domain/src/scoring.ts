import type { Company, HealthComponent, HealthLabel, MomentumLabel, PerformancePeriod } from "./types";

export function calculateHealthScore(components: HealthComponent[]): number {
  const weighted = components.reduce((total, component) => total + component.score * component.weight, 0);
  const weights = components.reduce((total, component) => total + component.weight, 0);
  return Math.round(weighted / Math.max(weights, 1));
}

export function getHealthLabel(score: number): HealthLabel {
  if (score >= 90) return "Excellent";
  if (score >= 78) return "Healthy";
  if (score >= 65) return "Watch";
  return "Needs review";
}

export function calculateMomentum(periods: PerformancePeriod[]): { score: number; label: MomentumLabel } {
  const weights: Record<string, number> = { "1M": 0.15, "3M": 0.25, "6M": 0.3, "1Y": 0.3 };
  const weightedReturn = periods.reduce(
    (total, period) => total + period.returnPct * (weights[period.shortLabel] ?? 0),
    0,
  );
  const score = Math.max(0, Math.min(100, Math.round(50 + weightedReturn * 1.8)));
  let label: MomentumLabel = "Flat";
  if (score >= 78) label = "Strong uptrend";
  else if (score >= 62) label = "Uptrend";
  else if (score < 28) label = "Downtrend";
  else if (score < 43) label = "Weak";
  return { score, label };
}

export function compareCompanies(companies: Company[]) {
  if (companies.length === 0) return undefined;
  return [...companies].sort((a, b) => b.health - a.health)[0];
}
