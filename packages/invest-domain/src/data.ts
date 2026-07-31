import type { AlertItem, Company, DashboardData, Metric, NewsItem, PerformancePeriod, ValuationMetric } from "./types";

const sparks = {
  strong: [18, 20, 19, 23, 25, 24, 28, 31, 30, 34, 37, 41],
  steady: [22, 23, 22, 25, 24, 26, 28, 27, 29, 31, 32, 34],
  flat: [28, 27, 29, 28, 26, 27, 25, 27, 26, 28, 27, 28],
  weak: [39, 37, 38, 34, 35, 32, 30, 31, 28, 26, 27, 24],
  recover: [34, 30, 27, 24, 22, 23, 25, 28, 27, 30, 33, 35],
};

function performance(values: [number, number, number, number, number, number], shape: keyof typeof sparks): PerformancePeriod[] {
  const labels = [
    ["1 month", "1M"],
    ["3 months", "3M"],
    ["6 months", "6M"],
    ["1 year", "1Y"],
    ["3 years", "3Y"],
    ["5 years", "5Y"],
  ] as const;
  return labels.map(([label, shortLabel], index) => ({
    label,
    shortLabel,
    returnPct: values[index] ?? 0,
    sparkline: sparks[shape].map((value, point) => value + Math.round(Math.sin(point + index) * 2)),
  }));
}

function metric(label: string, value: string, status: Metric["status"], context: string): Metric {
  return { label, value, status, context };
}

function valuation(label: string, value: string, status: Metric["status"], history: string, sector: string): ValuationMetric {
  return { label, value, status, context: `${history} vs history`, history, sector };
}

function news(symbol: string, items: Array<[string, string, NewsItem["impact"], string]>): NewsItem[] {
  return items.map(([title, source, impact, summary], index) => ({
    id: `${symbol}-${index + 1}`,
    title,
    source,
    age: index === 0 ? "2h" : index === 1 ? "Yesterday" : "3d",
    impact,
    summary,
  }));
}

export const companies: Company[] = [
  {
    symbol: "MSFT",
    name: "Microsoft",
    sector: "Technology",
    accent: "#6d8f78",
    price: 423.18,
    dayChangePct: 1.24,
    shares: 36,
    allocationPct: 27.4,
    health: 92,
    healthLabel: "Excellent",
    healthDelta: 2,
    momentumScore: 86,
    momentum: "Strong uptrend",
    momentumDirection: "up",
    momentumExplanation: "Every measured period is positive, with the strongest acceleration in the last six months.",
    valuationLabel: "Fair",
    risk: "Low",
    status: "Healthy",
    keyChange: "Cloud growth accelerated while operating margins expanded.",
    updatedAt: "8 min ago",
    performance: performance([3.2, 10.8, 18.4, 24.6, 74.2, 201.3], "strong"),
    annualReturns: [{ year: 2021, returnPct: 41 }, { year: 2022, returnPct: -27 }, { year: 2023, returnPct: 54 }, { year: 2024, returnPct: 31 }, { year: 2025, returnPct: 22 }, { year: 2026, returnPct: 8 }],
    fundamentals: [metric("Revenue growth", "18.2%", "positive", "Accelerating"), metric("EPS growth", "21.4%", "positive", "Above 5Y median"), metric("Operating margin", "44.6%", "positive", "+180 bps YoY"), metric("Gross margin", "69.1%", "positive", "Stable"), metric("Free cash flow", "$74.1B", "positive", "+16% YoY"), metric("Debt / equity", "0.32", "positive", "Conservative"), metric("Cash", "$80.7B", "positive", "Strong liquidity"), metric("ROIC", "28.6%", "positive", "Top quartile")],
    valuation: [valuation("P / E", "32.4×", "neutral", "1.1×", "0.9×"), valuation("Forward P / E", "28.1×", "neutral", "1.0×", "0.9×"), valuation("PEG", "1.7×", "neutral", "0.9×", "0.8×"), valuation("Price / sales", "11.8×", "negative", "1.2×", "1.8×"), valuation("EV / EBITDA", "23.6×", "neutral", "1.1×", "1.2×")],
    healthComponents: [{ label: "Performance", score: 94, weight: 20, trend: "up" }, { label: "Momentum", score: 86, weight: 15, trend: "up" }, { label: "Revenue growth", score: 95, weight: 15, trend: "up" }, { label: "EPS growth", score: 96, weight: 15, trend: "up" }, { label: "Cash flow", score: 94, weight: 10, trend: "up" }, { label: "Margins", score: 96, weight: 10, trend: "up" }, { label: "Debt", score: 91, weight: 10, trend: "flat" }, { label: "Valuation", score: 70, weight: 5, trend: "flat" }],
    aiSummary: ["Revenue growth accelerated to 18%, led by durable cloud demand.", "Operating leverage improved as margins expanded 180 basis points.", "Management maintained an elevated AI investment pace without weakening free cash flow.", "The long-term thesis remains intact; valuation is the main constraint."],
    positives: ["Cloud growth is reaccelerating", "Margins and free cash flow improved", "Balance sheet remains resilient"],
    risks: ["Premium valuation limits margin of safety", "AI infrastructure spending must translate into durable returns"],
    thesis: ["Cloud platform leadership", "Distribution advantage in enterprise software", "AI products deepen the ecosystem", "Durable free-cash-flow compounder"],
    thesisStatus: "Intact — 4 of 4 pillars supported",
    news: news("MSFT", [["Cloud demand supports another quarter of double-digit growth", "Company update", "material", "Supports the revenue-growth and margin pillars of the thesis."], ["New Copilot features expand across enterprise products", "Product news", "context", "Strategically relevant, but financial impact is not yet separately disclosed."], ["Analyst raises price target after results", "Market commentary", "noise", "A price-target change does not alter business fundamentals."]]),
  },
  {
    symbol: "GOOGL", name: "Alphabet", sector: "Communication services", accent: "#778ca8", price: 189.44, dayChangePct: 0.48, shares: 54, allocationPct: 18.3, health: 88, healthLabel: "Healthy", healthDelta: 1, momentumScore: 78, momentum: "Uptrend", momentumDirection: "up", momentumExplanation: "The 1-, 3-, 6-, and 12-month periods are positive, with steady rather than accelerating gains.", valuationLabel: "Attractive", risk: "Moderate", status: "Healthy", keyChange: "Search resilience and cloud profitability offset higher AI capital spending.", updatedAt: "11 min ago",
    performance: performance([2.1, 8.6, 14.7, 19.8, 68.4, 156.2], "steady"), annualReturns: [{ year: 2021, returnPct: 65 }, { year: 2022, returnPct: -39 }, { year: 2023, returnPct: 58 }, { year: 2024, returnPct: 36 }, { year: 2025, returnPct: 18 }, { year: 2026, returnPct: 6 }],
    fundamentals: [metric("Revenue growth", "14.8%", "positive", "Stable"), metric("EPS growth", "18.7%", "positive", "Above revenue"), metric("Operating margin", "31.5%", "positive", "+120 bps YoY"), metric("Gross margin", "57.9%", "neutral", "Stable"), metric("Free cash flow", "$72.8B", "positive", "Strong"), metric("Debt / equity", "0.10", "positive", "Very low"), metric("Cash", "$110.9B", "positive", "Net cash"), metric("ROIC", "24.8%", "positive", "Improving")],
    valuation: [valuation("P / E", "24.8×", "positive", "0.9×", "0.7×"), valuation("Forward P / E", "21.6×", "positive", "0.8×", "0.7×"), valuation("PEG", "1.3×", "positive", "0.8×", "0.7×"), valuation("Price / sales", "6.4×", "neutral", "1.0×", "1.1×"), valuation("EV / EBITDA", "16.2×", "positive", "0.8×", "0.9×")],
    healthComponents: [{ label: "Performance", score: 83, weight: 20, trend: "up" }, { label: "Momentum", score: 78, weight: 15, trend: "up" }, { label: "Revenue growth", score: 88, weight: 15, trend: "flat" }, { label: "EPS growth", score: 91, weight: 15, trend: "up" }, { label: "Cash flow", score: 94, weight: 10, trend: "up" }, { label: "Margins", score: 90, weight: 10, trend: "up" }, { label: "Debt", score: 98, weight: 10, trend: "flat" }, { label: "Valuation", score: 86, weight: 5, trend: "up" }],
    aiSummary: ["Core search demand remains resilient despite rapid changes in AI interfaces.", "Cloud profitability improved and is becoming a more meaningful earnings contributor.", "Capital spending is rising, but the balance sheet provides ample flexibility.", "The thesis remains intact with regulatory exposure as the primary watch item."], positives: ["Attractive relative valuation", "Cloud margins are expanding", "Exceptional balance sheet"], risks: ["Regulatory remedies remain uncertain", "AI capex is rising faster than revenue"], thesis: ["Search distribution moat", "YouTube's durable attention share", "Cloud as a second profit engine", "Deep AI research advantage"], thesisStatus: "Intact — regulatory risk elevated", news: news("GOOGL", [["Cloud margins widen as enterprise AI demand grows", "Earnings call", "material", "Supports the second-profit-engine pillar."], ["Regulators outline next stage of search remedies", "Policy desk", "material", "Could affect distribution economics; outcome remains unknown."], ["New model benchmarks lead developer rankings", "Technology press", "context", "Supports technical capability but not yet monetization."]]),
  },
  {
    symbol: "META", name: "Meta Platforms", sector: "Communication services", accent: "#9a7f68", price: 612.35, dayChangePct: 1.82, shares: 18, allocationPct: 19.8, health: 90, healthLabel: "Excellent", healthDelta: 3, momentumScore: 89, momentum: "Strong uptrend", momentumDirection: "up", momentumExplanation: "Strength is broad across every timeframe, and recent gains are supported by improving earnings momentum.", valuationLabel: "Fair", risk: "Moderate", status: "Healthy", keyChange: "Ad efficiency and engagement improved faster than infrastructure costs.", updatedAt: "14 min ago",
    performance: performance([4.7, 13.2, 21.9, 31.4, 128.3, 196.8], "strong"), annualReturns: [{ year: 2021, returnPct: 23 }, { year: 2022, returnPct: -64 }, { year: 2023, returnPct: 194 }, { year: 2024, returnPct: 65 }, { year: 2025, returnPct: 28 }, { year: 2026, returnPct: 11 }],
    fundamentals: [metric("Revenue growth", "19.1%", "positive", "Accelerating"), metric("EPS growth", "27.6%", "positive", "Operating leverage"), metric("Operating margin", "42.2%", "positive", "+240 bps YoY"), metric("Gross margin", "81.4%", "positive", "Stable"), metric("Free cash flow", "$52.1B", "positive", "+22% YoY"), metric("Debt / equity", "0.24", "positive", "Conservative"), metric("Cash", "$70.2B", "positive", "Strong"), metric("ROIC", "31.2%", "positive", "Excellent")],
    valuation: [valuation("P / E", "27.2×", "neutral", "1.1×", "0.8×"), valuation("Forward P / E", "23.7×", "positive", "0.9×", "0.8×"), valuation("PEG", "1.1×", "positive", "0.7×", "0.6×"), valuation("Price / sales", "9.1×", "neutral", "1.1×", "1.5×"), valuation("EV / EBITDA", "18.8×", "neutral", "1.0×", "1.0×")],
    healthComponents: [{ label: "Performance", score: 94, weight: 20, trend: "up" }, { label: "Momentum", score: 89, weight: 15, trend: "up" }, { label: "Revenue growth", score: 90, weight: 15, trend: "up" }, { label: "EPS growth", score: 91, weight: 15, trend: "up" }, { label: "Cash flow", score: 88, weight: 10, trend: "up" }, { label: "Margins", score: 90, weight: 10, trend: "up" }, { label: "Debt", score: 93, weight: 10, trend: "flat" }, { label: "Valuation", score: 72, weight: 5, trend: "flat" }],
    aiSummary: ["Advertising demand and recommendation quality both improved.", "Expense discipline allowed revenue growth to translate into faster EPS growth.", "AI infrastructure commitments are large but currently supported by cash generation.", "The thesis is strengthening, though spending discipline remains important."], positives: ["Best-in-group earnings momentum", "High engagement across core apps", "Strong buyback capacity"], risks: ["Infrastructure spending could outpace returns", "Regulatory exposure across multiple regions"], thesis: ["Global social distribution", "AI-driven recommendation advantage", "High incremental margins", "Founder-led long-term execution"], thesisStatus: "Strengthening — execution ahead of plan", news: news("META", [["Ad tools deliver stronger returns for small businesses", "Industry survey", "material", "Supports monetization and recommendation-quality pillars."], ["Company outlines larger infrastructure roadmap", "Company update", "context", "Raises execution requirements but remains affordable today."], ["New consumer app reaches download milestone", "Technology press", "noise", "Engagement durability matters more than initial downloads."]]),
  },
  {
    symbol: "AMZN", name: "Amazon", sector: "Consumer discretionary", accent: "#b08d57", price: 207.62, dayChangePct: -0.74, shares: 48, allocationPct: 17.9, health: 76, healthLabel: "Watch", healthDelta: -4, momentumScore: 45, momentum: "Flat", momentumDirection: "down", momentumExplanation: "Longer-term returns remain positive, but negative 1- and 3-month trends show that momentum has stalled.", valuationLabel: "Elevated", risk: "Moderate", status: "Watch", keyChange: "Retail margins improved, but cloud growth softened and capex guidance rose.", updatedAt: "17 min ago",
    performance: performance([-2.8, -1.1, 3.4, 8.7, 41.3, 72.5], "flat"), annualReturns: [{ year: 2021, returnPct: 2 }, { year: 2022, returnPct: -50 }, { year: 2023, returnPct: 81 }, { year: 2024, returnPct: 44 }, { year: 2025, returnPct: 9 }, { year: 2026, returnPct: -3 }],
    fundamentals: [metric("Revenue growth", "10.4%", "neutral", "Decelerating"), metric("EPS growth", "17.2%", "positive", "Margin-led"), metric("Operating margin", "11.3%", "positive", "+90 bps YoY"), metric("Gross margin", "49.2%", "neutral", "Improving"), metric("Free cash flow", "$36.8B", "neutral", "Capex pressure"), metric("Debt / equity", "0.48", "neutral", "Manageable"), metric("Cash", "$78.1B", "positive", "Strong liquidity"), metric("ROIC", "14.1%", "neutral", "Improving")],
    valuation: [valuation("P / E", "38.6×", "negative", "0.9×", "1.3×"), valuation("Forward P / E", "31.4×", "negative", "0.8×", "1.2×"), valuation("PEG", "2.0×", "negative", "1.0×", "1.1×"), valuation("Price / sales", "3.4×", "neutral", "1.0×", "0.8×"), valuation("EV / EBITDA", "18.9×", "neutral", "0.9×", "1.1×")],
    healthComponents: [{ label: "Performance", score: 75, weight: 20, trend: "down" }, { label: "Momentum", score: 45, weight: 15, trend: "down" }, { label: "Revenue growth", score: 82, weight: 15, trend: "down" }, { label: "EPS growth", score: 86, weight: 15, trend: "up" }, { label: "Cash flow", score: 83, weight: 10, trend: "down" }, { label: "Margins", score: 91, weight: 10, trend: "up" }, { label: "Debt", score: 88, weight: 10, trend: "flat" }, { label: "Valuation", score: 66, weight: 5, trend: "down" }],
    aiSummary: ["Retail profitability continues to improve through regionalization and cost control.", "Cloud growth softened, reducing the portfolio's highest-margin growth engine.", "Higher infrastructure spending is pressuring near-term free cash flow.", "The thesis is not broken, but cloud reacceleration is now the key evidence to watch."], positives: ["Retail margins continue to scale", "Advertising remains a high-margin contributor", "Liquidity is strong"], risks: ["Cloud growth is losing momentum", "Capex may suppress free cash flow longer than expected"], thesis: ["AWS leadership", "Retail logistics scale", "Advertising as a profit engine", "Long runway for operating leverage"], thesisStatus: "Watch — AWS pillar needs confirmation", news: news("AMZN", [["Cloud growth comes in below elevated expectations", "Earnings call", "material", "Weakens the AWS leadership pillar and warrants monitoring."], ["Same-day delivery expands to more markets", "Company update", "context", "Supports retail convenience and asset utilization."], ["Prime event sets a new sales record", "Company release", "noise", "A single promotional event does not establish a durable trend."]]),
  },
  {
    symbol: "AAPL", name: "Apple", sector: "Technology", accent: "#8d9298", price: 224.91, dayChangePct: -1.08, shares: 41, allocationPct: 16.6, health: 69, healthLabel: "Watch", healthDelta: -5, momentumScore: 34, momentum: "Weak", momentumDirection: "down", momentumExplanation: "The 1-, 3-, and 6-month trends are negative, and the 1-year return is barely positive.", valuationLabel: "Expensive", risk: "Moderate", status: "Needs review", keyChange: "Services held firm, but product revenue and estimate revisions weakened.", updatedAt: "20 min ago",
    performance: performance([-4.2, -7.6, -3.1, 2.4, 32.8, 164.7], "weak"), annualReturns: [{ year: 2021, returnPct: 35 }, { year: 2022, returnPct: -27 }, { year: 2023, returnPct: 49 }, { year: 2024, returnPct: 30 }, { year: 2025, returnPct: 5 }, { year: 2026, returnPct: -6 }],
    fundamentals: [metric("Revenue growth", "3.1%", "negative", "Below target"), metric("EPS growth", "5.6%", "neutral", "Buyback aided"), metric("Operating margin", "31.8%", "positive", "Stable"), metric("Gross margin", "46.7%", "positive", "Services mix"), metric("Free cash flow", "$102.4B", "positive", "Durable"), metric("Debt / equity", "1.48", "negative", "Elevated"), metric("Cash", "$61.5B", "positive", "Adequate"), metric("ROIC", "51.6%", "positive", "Exceptional")],
    valuation: [valuation("P / E", "34.9×", "negative", "1.4×", "1.0×"), valuation("Forward P / E", "31.7×", "negative", "1.3×", "1.0×"), valuation("PEG", "3.8×", "negative", "1.6×", "1.4×"), valuation("Price / sales", "8.7×", "negative", "1.5×", "1.4×"), valuation("EV / EBITDA", "25.2×", "negative", "1.4×", "1.3×")],
    healthComponents: [{ label: "Performance", score: 70, weight: 20, trend: "down" }, { label: "Momentum", score: 34, weight: 15, trend: "down" }, { label: "Revenue growth", score: 60, weight: 15, trend: "down" }, { label: "EPS growth", score: 72, weight: 15, trend: "flat" }, { label: "Cash flow", score: 100, weight: 10, trend: "flat" }, { label: "Margins", score: 95, weight: 10, trend: "up" }, { label: "Debt", score: 80, weight: 10, trend: "flat" }, { label: "Valuation", score: 48, weight: 5, trend: "down" }],
    aiSummary: ["Services growth and mix continue to support margins and cash generation.", "Product revenue remains muted, and consensus estimates moved lower.", "The current valuation implies a faster growth rate than recent fundamentals support.", "The ecosystem thesis remains intact, but growth evidence is insufficient for the premium multiple."], positives: ["Services mix supports margins", "Installed base remains highly engaged", "Free cash flow is exceptional"], risks: ["Revenue growth remains below thesis target", "Valuation leaves little room for disappointment"], thesis: ["Premium integrated ecosystem", "Services monetization", "Pricing power and loyalty", "Capital returns supported by cash flow"], thesisStatus: "Needs review — growth pillar is weakening", news: news("AAPL", [["Supplier data points to softer premium-device demand", "Supply-chain report", "material", "Adds evidence that product growth may remain below thesis targets."], ["Services revenue reaches a new quarterly high", "Company update", "material", "Supports the services monetization pillar."], ["Rumors circulate around future device form factor", "Technology press", "noise", "Unconfirmed product rumors do not affect the current thesis."]]),
  },
];

export const alerts: AlertItem[] = [
  { id: "alert-aapl", symbol: "AAPL", company: "Apple", severity: "attention", title: "Health fell below 70", reason: "Revenue growth slowed and the valuation component weakened.", scoreChange: "74 → 69", time: "Today, 8:42 AM", read: false },
  { id: "alert-amzn", symbol: "AMZN", company: "Amazon", severity: "watch", title: "Momentum turned flat", reason: "The 1- and 3-month trends are now negative while cloud growth softened.", scoreChange: "82 → 76", time: "Today, 7:15 AM", read: false },
  { id: "alert-meta", symbol: "META", company: "Meta Platforms", severity: "positive", title: "Margins improved", reason: "Operating margin expanded 240 basis points with revenue still accelerating.", scoreChange: "87 → 90", time: "Yesterday", read: true },
  { id: "alert-googl", symbol: "GOOGL", company: "Alphabet", severity: "watch", title: "Regulatory risk updated", reason: "Proposed search remedies could affect distribution economics; outcome is still unknown.", time: "2 days ago", read: true },
];

const totalValue = companies.reduce((sum, company) => sum + company.price * company.shares, 0);

export const dashboardData: DashboardData = {
  portfolio: {
    totalValue,
    dayChangePct: 0.58,
    dayChangeValue: totalValue * 0.0058,
    periodReturns: { "1M": 1.4, "6M": 10.8, YTD: 12.6, "1Y": 18.9, "5Y": 132.4 },
    averageHealth: Math.round(companies.reduce((sum, company) => sum + company.health, 0) / companies.length),
    averageMomentum: Math.round(companies.reduce((sum, company) => sum + company.momentumScore, 0) / companies.length),
    risk: "Moderate",
    diversification: 71,
    largestWinner: "META +31.4%",
    largestLoser: "AAPL −7.6%",
  },
  companies,
  alerts,
  generatedAt: new Date().toISOString(),
  dataMode: "illustrative",
};

export function findCompany(symbol: string): Company | undefined {
  return companies.find((company) => company.symbol === symbol.toUpperCase());
}
