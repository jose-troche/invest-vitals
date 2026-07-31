import {
  calculateHealthScore,
  calculateMomentum,
  getHealthLabel,
  type Company,
  type DashboardData,
  type HealthComponent,
  type MarketSnapshot,
  type PerformancePeriod,
  type SymbolSearchResult,
  type WatchlistQuote,
} from "@invest-vitals/domain";

const MARKET_TTL_SECONDS = 15 * 60;
const SEARCH_TTL_SECONDS = 60 * 60;
const PROVIDER = "Yahoo Finance chart API (unofficial)";

type CacheWriter = (promise: Promise<unknown>) => void;

interface YahooChartPayload {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
        currency?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

interface YahooSearchPayload {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
    typeDisp?: string;
  }>;
}

interface PricePoint {
  timestamp: number;
  price: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function nearestPoint(points: PricePoint[], timestamp: number): PricePoint {
  let selected = points[0] ?? { timestamp, price: 0 };
  for (const point of points) {
    if (point.timestamp > timestamp) break;
    selected = point;
  }
  return selected;
}

function period(points: PricePoint[], end: PricePoint, label: string, shortLabel: string, days: number): PerformancePeriod {
  const startTime = end.timestamp - days * 86_400;
  const start = nearestPoint(points, startTime);
  const periodPoints = points.filter((point) => point.timestamp >= start.timestamp);
  const stride = Math.max(1, Math.ceil(periodPoints.length / 12));
  const sparkline = periodPoints.filter((_, index) => index % stride === 0).slice(-12).map((point) => round(point.price));
  if (sparkline.at(-1) !== round(end.price)) sparkline.push(round(end.price));
  return {
    label,
    shortLabel,
    returnPct: start.price > 0 ? round(((end.price / start.price) - 1) * 100) : 0,
    sparkline,
  };
}

function annualReturns(points: PricePoint[]) {
  const years = new Map<number, PricePoint[]>();
  for (const point of points) {
    const year = new Date(point.timestamp * 1000).getUTCFullYear();
    years.set(year, [...(years.get(year) ?? []), point]);
  }
  return [...years.entries()].sort(([a], [b]) => a - b).slice(-6).map(([year, yearPoints]) => {
    const first = yearPoints[0];
    const last = yearPoints.at(-1);
    return { year, returnPct: first && last && first.price > 0 ? round(((last.price / first.price) - 1) * 100) : 0 };
  });
}

function directionFor(score: number): "up" | "flat" | "down" {
  if (score >= 60) return "up";
  if (score < 45) return "down";
  return "flat";
}

export function normalizeChartResponse(payload: YahooChartPayload, fetchedAt = new Date().toISOString(), sessionPreviousClose?: number): MarketSnapshot {
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error(payload.chart?.error?.description ?? "Market data response was empty");
  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const prices = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
  const points = timestamps.flatMap((timestamp, index) => {
    const price = prices[index];
    return isFiniteNumber(price) && price > 0 ? [{ timestamp, price }] : [];
  });
  const last = points.at(-1);
  if (!last || !meta.symbol || !isFiniteNumber(meta.regularMarketPrice)) throw new Error("Market data response was incomplete");
  const performance = [
    period(points, last, "1 month", "1M", 30),
    period(points, last, "3 months", "3M", 91),
    period(points, last, "6 months", "6M", 182),
    period(points, last, "1 year", "1Y", 365),
    period(points, last, "3 years", "3Y", 1_095),
    period(points, last, "5 years", "5Y", 1_825),
  ];
  const momentum = calculateMomentum(performance);
  const previousClose = sessionPreviousClose ?? meta.regularMarketPrice;
  const marketTime = new Date((meta.regularMarketTime ?? last.timestamp) * 1000).toISOString();
  return {
    symbol: meta.symbol.toUpperCase(),
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "Market",
    currency: meta.currency ?? "USD",
    price: round(meta.regularMarketPrice),
    previousClose: round(previousClose),
    dayChangePct: previousClose > 0 ? round(((meta.regularMarketPrice / previousClose) - 1) * 100) : 0,
    marketTime,
    performance,
    annualReturns: annualReturns(points),
    momentumScore: momentum.score,
    momentum: momentum.label,
    momentumDirection: directionFor(momentum.score),
    marketData: {
      source: PROVIDER,
      status: "live",
      asOf: marketTime,
      fetchedAt,
      note: "Price and return history from the latest provider response.",
    },
  };
}

export function normalizeSearchResponse(payload: YahooSearchPayload): SymbolSearchResult[] {
  const accepted = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX", "CRYPTOCURRENCY"]);
  const seen = new Set<string>();
  return (payload.quotes ?? []).flatMap((quote) => {
    const symbol = quote.symbol?.trim().toUpperCase();
    const type = quote.quoteType?.toUpperCase();
    if (!symbol || !type || !accepted.has(type) || seen.has(symbol)) return [];
    seen.add(symbol);
    return [{
      symbol,
      name: quote.longname ?? quote.shortname ?? symbol,
      exchange: quote.exchDisp ?? quote.exchange ?? "Market",
      type: quote.typeDisp ?? type,
    }];
  }).slice(0, 8);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 InvestVitals/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getMarketSnapshot(cache: KVNamespace, symbol: string, write: CacheWriter): Promise<MarketSnapshot> {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.^=-]{1,15}$/.test(normalized)) throw new Error("Invalid market symbol");
  const key = `market:v2:${normalized}`;
  const cached = await cache.get<MarketSnapshot>(key, "json");
  if (cached) return { ...cached, marketData: { ...cached.marketData, status: "cached" } };
  const [payload, sessionPayload] = await Promise.all([
    fetchJson<YahooChartPayload>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?range=5y&interval=1wk&events=div%2Csplits`),
    fetchJson<YahooChartPayload>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?range=5d&interval=1d`),
  ]);
  const snapshot = normalizeChartResponse(payload, new Date().toISOString(), extractSessionPreviousClose(sessionPayload));
  write(cache.put(key, JSON.stringify(snapshot), { expirationTtl: MARKET_TTL_SECONDS }).catch((error) => {
    console.error(JSON.stringify({ event: "market_cache_write_failed", symbol: normalized, error: String(error) }));
  }));
  return snapshot;
}

function extractSessionPreviousClose(payload: YahooChartPayload): number | undefined {
  const prices = payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(isFiniteNumber) ?? [];
  return prices.length >= 2 ? prices.at(-2) : undefined;
}

export async function searchMarket(cache: KVNamespace, query: string, write: CacheWriter): Promise<SymbolSearchResult[]> {
  const normalized = query.trim().slice(0, 80);
  if (normalized.length < 1) return [];
  const key = `search:v1:${normalized.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
  const cached = await cache.get<SymbolSearchResult[]>(key, "json");
  if (cached) return cached;
  const payload = await fetchJson<YahooSearchPayload>(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(normalized)}&quotesCount=8&newsCount=0`);
  const results = normalizeSearchResponse(payload);
  write(cache.put(key, JSON.stringify(results), { expirationTtl: SEARCH_TTL_SECONDS }).catch((error) => {
    console.error(JSON.stringify({ event: "search_cache_write_failed", error: String(error) }));
  }));
  return results;
}

function performanceScore(performance: PerformancePeriod[]): number {
  const oneYear = performance.find((item) => item.shortLabel === "1Y")?.returnPct ?? 0;
  const fiveYear = performance.find((item) => item.shortLabel === "5Y")?.returnPct ?? 0;
  return Math.max(0, Math.min(100, Math.round(55 + oneYear * 0.9 + fiveYear * 0.08)));
}

export function enrichCompany(company: Company, snapshot: MarketSnapshot): Company {
  const components: HealthComponent[] = company.healthComponents.map((component) => {
    if (component.label === "Performance") return { ...component, score: performanceScore(snapshot.performance), trend: snapshot.momentumDirection };
    if (component.label === "Momentum") return { ...component, score: snapshot.momentumScore, trend: snapshot.momentumDirection };
    return component;
  });
  const health = calculateHealthScore(components);
  const healthLabel = getHealthLabel(health);
  return {
    ...company,
    name: snapshot.name || company.name,
    price: snapshot.price,
    dayChangePct: snapshot.dayChangePct,
    health,
    healthLabel,
    healthDelta: health - company.health,
    status: healthLabel === "Needs review" ? "Needs review" : healthLabel === "Watch" ? "Watch" : "Healthy",
    momentumScore: snapshot.momentumScore,
    momentum: snapshot.momentum,
    momentumDirection: snapshot.momentumDirection,
    momentumExplanation: "Momentum is calculated from the latest 1-, 3-, 6-, and 12-month adjusted-price returns.",
    updatedAt: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(snapshot.marketTime)) + " UTC",
    performance: snapshot.performance,
    annualReturns: snapshot.annualReturns,
    healthComponents: components,
    marketData: snapshot.marketData,
  };
}

export function accentForSymbol(symbol: string): string {
  const colors = ["#6d8f78", "#778ca8", "#9a7f68", "#b08d57", "#8d9298", "#7f7296"];
  const hash = [...symbol].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? colors[0]!;
}

export function toWatchlistQuote(snapshot: MarketSnapshot, company?: Company): WatchlistQuote {
  const enriched = company ? enrichCompany(company, snapshot) : undefined;
  return {
    ...snapshot,
    accent: company?.accent ?? accentForSymbol(snapshot.symbol),
    health: enriched?.health,
    healthLabel: enriched?.healthLabel,
    healthDelta: enriched?.healthDelta,
    keyChange: company?.keyChange ?? `${snapshot.momentum}; ${snapshot.dayChangePct >= 0 ? "+" : ""}${snapshot.dayChangePct}% in the latest session.`,
    hasCompanyDetails: Boolean(company),
  };
}

export function createDashboard(base: DashboardData, enrichedCompanies: Company[]): DashboardData {
  if (enrichedCompanies.length === 0) return base;
  const totalValue = enrichedCompanies.reduce((sum, company) => sum + company.price * company.shares, 0);
  const weighted = (select: (company: Company) => number) => totalValue > 0
    ? enrichedCompanies.reduce((sum, company) => sum + select(company) * company.price * company.shares, 0) / totalValue
    : 0;
  const periodReturn = (shortLabel: string) => round(weighted((company) => company.performance.find((item) => item.shortLabel === shortLabel)?.returnPct ?? 0));
  const currentYear = new Date().getUTCFullYear();
  const yearToDate = round(weighted((company) => company.annualReturns.find((item) => item.year === currentYear)?.returnPct ?? 0));
  const sortedMonthly = [...enrichedCompanies].sort((a, b) => periodReturnFor(b, "1M") - periodReturnFor(a, "1M"));
  const statuses = enrichedCompanies.map((company) => company.marketData?.status ?? "fallback");
  const freshest = [...enrichedCompanies].sort((a, b) => Date.parse(b.marketData?.asOf ?? "") - Date.parse(a.marketData?.asOf ?? ""))[0]?.marketData;
  return {
    ...base,
    companies: enrichedCompanies,
    portfolio: {
      ...base.portfolio,
      totalValue: round(totalValue),
      dayChangePct: round(weighted((company) => company.dayChangePct)),
      dayChangeValue: round(totalValue * weighted((company) => company.dayChangePct) / 100),
      periodReturns: { "1M": periodReturn("1M"), "6M": periodReturn("6M"), YTD: yearToDate, "1Y": periodReturn("1Y"), "5Y": periodReturn("5Y") },
      averageHealth: Math.round(weighted((company) => company.health)),
      averageMomentum: Math.round(weighted((company) => company.momentumScore)),
      largestWinner: sortedMonthly[0] ? `${sortedMonthly[0].symbol} ${signed(periodReturnFor(sortedMonthly[0], "1M"))}%` : "—",
      largestLoser: sortedMonthly.at(-1) ? `${sortedMonthly.at(-1)!.symbol} ${signed(periodReturnFor(sortedMonthly.at(-1)!, "1M"))}%` : "—",
    },
    generatedAt: new Date().toISOString(),
    dataMode: "mixed",
    marketData: {
      source: PROVIDER,
      status: statuses.some((status) => status === "fallback") ? "fallback" : statuses.every((status) => status === "live") ? "live" : "cached",
      asOf: freshest?.asOf ?? new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      note: "Live or cached prices and returns; fundamentals, valuation, thesis, and news remain the baseline dataset.",
    },
  };
}

function periodReturnFor(company: Company, shortLabel: string): number {
  return company.performance.find((item) => item.shortLabel === shortLabel)?.returnPct ?? 0;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${round(value)}`;
}
