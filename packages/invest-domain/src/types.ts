export type Signal = "positive" | "neutral" | "negative";
export type HealthLabel = "Excellent" | "Healthy" | "Watch" | "Needs review";
export type MomentumLabel = "Strong uptrend" | "Uptrend" | "Flat" | "Weak" | "Downtrend" | "Recovering";

export interface PerformancePeriod {
  label: string;
  shortLabel: string;
  returnPct: number;
  sparkline: number[];
}

export interface AnnualReturn {
  year: number;
  returnPct: number;
}

export interface Metric {
  label: string;
  value: string;
  status: Signal;
  context: string;
}

export interface ValuationMetric extends Metric {
  history: string;
  sector: string;
}

export interface HealthComponent {
  label: string;
  score: number;
  weight: number;
  trend: "up" | "flat" | "down";
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  age: string;
  impact: "material" | "context" | "noise";
  summary: string;
}

export interface Company {
  symbol: string;
  name: string;
  sector: string;
  accent: string;
  price: number;
  dayChangePct: number;
  shares: number;
  allocationPct: number;
  health: number;
  healthLabel: HealthLabel;
  healthDelta: number;
  momentumScore: number;
  momentum: MomentumLabel;
  momentumDirection: "up" | "flat" | "down";
  momentumExplanation: string;
  valuationLabel: "Attractive" | "Fair" | "Elevated" | "Expensive";
  risk: "Low" | "Moderate" | "High";
  status: "Healthy" | "Watch" | "Needs review";
  keyChange: string;
  updatedAt: string;
  performance: PerformancePeriod[];
  annualReturns: AnnualReturn[];
  fundamentals: Metric[];
  valuation: ValuationMetric[];
  healthComponents: HealthComponent[];
  aiSummary: string[];
  positives: string[];
  risks: string[];
  thesis: string[];
  thesisStatus: string;
  news: NewsItem[];
}

export interface PortfolioSummary {
  totalValue: number;
  dayChangePct: number;
  dayChangeValue: number;
  periodReturns: Record<"1M" | "6M" | "YTD" | "1Y" | "5Y", number>;
  averageHealth: number;
  averageMomentum: number;
  risk: string;
  diversification: number;
  largestWinner: string;
  largestLoser: string;
}

export interface AlertItem {
  id: string;
  symbol: string;
  company: string;
  severity: "attention" | "watch" | "positive";
  title: string;
  reason: string;
  scoreChange?: string;
  time: string;
  read: boolean;
}

export interface DashboardData {
  portfolio: PortfolioSummary;
  companies: Company[];
  alerts: AlertItem[];
  generatedAt: string;
  dataMode: "illustrative" | "live";
}

export interface ComparisonRow {
  label: string;
  values: Record<string, string | number>;
  winner?: string;
}

export interface ComparisonResult {
  symbols: string[];
  rows: ComparisonRow[];
  conclusion: string;
}

export interface AssistantAnswer {
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  followUps: string[];
}
