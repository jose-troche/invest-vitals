import {
  calculateHealthScore,
  getHealthLabel,
  type Company,
  type CompanyEvidence,
  type Metric,
  type NewsItem,
} from "@invest-vitals/domain";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function signal(value: number, positive: number, neutral: number): Metric["status"] {
  if (value >= positive) return "positive";
  if (value >= neutral) return "neutral";
  return "negative";
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function replaceMetric(metrics: Metric[], label: string, value: number | undefined, positive: number, neutral: number, context: string): Metric[] {
  if (value === undefined) return metrics;
  return metrics.map((metric) => metric.label === label ? { ...metric, value: formatPercent(value), status: signal(value, positive, neutral), context } : metric);
}

function newsAge(publishedAt: string): string {
  const hours = Math.max(0, Math.round((Date.now() - Date.parse(publishedAt)) / 3_600_000));
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function providerNews(evidence: CompanyEvidence): NewsItem[] {
  return evidence.news.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    age: newsAge(item.publishedAt),
    impact: Math.abs(item.sentiment ?? 0) >= 0.3 ? "material" : "context",
    summary: item.summary || "Open the source for the full report.",
  }));
}

export function applyEvidence(company: Company, evidence: CompanyEvidence): Company {
  const fundamentals = evidence.fundamentals;
  let metrics = company.fundamentals;
  if (fundamentals) {
    metrics = replaceMetric(metrics, "Revenue growth", fundamentals.revenueGrowthPct, 10, 3, `Provider period ${fundamentals.fiscalPeriod}`);
    metrics = replaceMetric(metrics, "EPS growth", fundamentals.epsGrowthPct, 12, 2, `Provider period ${fundamentals.fiscalPeriod}`);
    metrics = replaceMetric(metrics, "Operating margin", fundamentals.operatingMarginPct, 20, 10, `Provider period ${fundamentals.fiscalPeriod}`);
    metrics = replaceMetric(metrics, "Gross margin", fundamentals.grossMarginPct, 40, 20, `Provider period ${fundamentals.fiscalPeriod}`);
  }

  const components = company.healthComponents.map((component) => {
    if (!fundamentals) return component;
    if (component.label === "Revenue growth" && fundamentals.revenueGrowthPct !== undefined) return { ...component, score: clamp(50 + fundamentals.revenueGrowthPct * 2.5), trend: fundamentals.revenueGrowthPct >= 0 ? "up" as const : "down" as const };
    if (component.label === "EPS growth" && fundamentals.epsGrowthPct !== undefined) return { ...component, score: clamp(50 + fundamentals.epsGrowthPct * 2.2), trend: fundamentals.epsGrowthPct >= 0 ? "up" as const : "down" as const };
    if (component.label === "Margins" && fundamentals.operatingMarginPct !== undefined) return { ...component, score: clamp(45 + fundamentals.operatingMarginPct * 1.6), trend: fundamentals.operatingMarginPct >= 15 ? "up" as const : "flat" as const };
    return component;
  });
  const health = calculateHealthScore(components);
  const healthLabel = getHealthLabel(health);
  const latestEarnings = evidence.earnings[0];
  const keyChange = latestEarnings?.surprisePct !== undefined
    ? `Latest reported EPS ${latestEarnings.surprisePct >= 0 ? "beat" : "missed"} estimates by ${Math.abs(latestEarnings.surprisePct).toFixed(1)}%.`
    : company.keyChange;

  return {
    ...company,
    health,
    healthLabel,
    healthDelta: health - company.health,
    status: healthLabel === "Needs review" ? "Needs review" : healthLabel === "Watch" ? "Watch" : "Healthy",
    keyChange,
    fundamentals: metrics,
    healthComponents: components,
    news: evidence.news.length > 0 ? providerNews(evidence) : company.news,
    evidence,
  };
}
