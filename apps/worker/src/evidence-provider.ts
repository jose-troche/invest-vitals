import type {
  CompanyEvidence,
  EvidenceProvenance,
  NormalizedEarnings,
  NormalizedFundamentals,
  NormalizedNewsItem,
  NormalizedSecFiling,
} from "@invest-vitals/domain";

const EVIDENCE_TTL_SECONDS = 24 * 60 * 60;
const SEC_TICKERS_TTL_SECONDS = 7 * EVIDENCE_TTL_SECONDS;

type CacheWriter = (promise: Promise<unknown>) => void;

export interface CompanyEvidenceProvider {
  readonly name: string;
  load(symbol: string): Promise<Partial<CompanyEvidence>>;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value === "None" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function percentage(value: unknown): number | undefined {
  const number = numberValue(value);
  return number === undefined ? undefined : Math.round(number * 10_000) / 100;
}

function provenance(source: string, asOf: string, status: EvidenceProvenance["status"] = "live"): EvidenceProvenance {
  return { source, asOf, fetchedAt: new Date().toISOString(), status };
}

function withCachedProvenance<T extends { provenance: EvidenceProvenance }>(item: T): T {
  return { ...item, provenance: { ...item.provenance, status: "cached" } };
}

async function fetchJson<T>(url: URL, headers?: HeadersInit): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Evidence provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function cachedValue<T>(cache: KVNamespace, key: string, write: CacheWriter, load: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
  const cached = await cache.get<T>(key, "json");
  if (cached !== null) return { value: cached, cached: true };
  const value = await load();
  write(cache.put(key, JSON.stringify(value), { expirationTtl: EVIDENCE_TTL_SECONDS }).catch((error) => {
    console.error(JSON.stringify({ event: "evidence_cache_write_failed", key, error: String(error) }));
  }));
  return { value, cached: false };
}

interface AlphaOverviewPayload extends Record<string, unknown> {
  Symbol?: string;
  LatestQuarter?: string;
  QuarterlyRevenueGrowthYOY?: string;
  QuarterlyEarningsGrowthYOY?: string;
  OperatingMarginTTM?: string;
  GrossProfitTTM?: string;
  RevenueTTM?: string;
  MarketCapitalization?: string;
  ReturnOnEquityTTM?: string;
  Note?: string;
  Information?: string;
}

interface AlphaEarningsPayload {
  symbol?: string;
  quarterlyEarnings?: Array<{
    fiscalDateEnding?: string;
    reportedDate?: string;
    reportedEPS?: string;
    estimatedEPS?: string;
    surprisePercentage?: string;
  }>;
  Note?: string;
  Information?: string;
}

interface AlphaNewsPayload {
  feed?: Array<{
    title?: string;
    url?: string;
    time_published?: string;
    authors?: string[];
    summary?: string;
    source?: string;
    overall_sentiment_score?: number;
    ticker_sentiment?: Array<{ ticker?: string; ticker_sentiment_score?: string }>;
  }>;
  Note?: string;
  Information?: string;
}

function assertAlphaPayload(payload: { Note?: string; Information?: string }): void {
  if (payload.Note || payload.Information) throw new Error("Alpha Vantage quota or provider response prevented refresh");
}

function alphaUrl(apiKey: string, fn: string, symbol: string): URL {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", fn);
  url.searchParams.set(fn === "NEWS_SENTIMENT" ? "tickers" : "symbol", symbol);
  if (fn === "NEWS_SENTIMENT") {
    url.searchParams.set("sort", "LATEST");
    url.searchParams.set("limit", "10");
  }
  url.searchParams.set("apikey", apiKey);
  return url;
}

function alphaTimestamp(value?: string): string {
  if (!value || !/^\d{8}T\d{4,6}$/.test(value)) return new Date().toISOString();
  const seconds = value.length === 15 ? value.slice(13, 15) : "00";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${seconds}Z`;
}

export class AlphaVantageProvider implements CompanyEvidenceProvider {
  readonly name = "Alpha Vantage";

  constructor(private readonly apiKey: string, private readonly cache: KVNamespace, private readonly write: CacheWriter) {}

  async load(symbol: string): Promise<Partial<CompanyEvidence>> {
    const normalized = symbol.toUpperCase();
    const [fundamentals, earnings, news] = await Promise.all([
      this.fundamentals(normalized),
      this.earnings(normalized),
      this.news(normalized),
    ]);
    return { symbol: normalized, fundamentals, earnings, news };
  }

  private async fundamentals(symbol: string): Promise<NormalizedFundamentals> {
    const result = await cachedValue(this.cache, `evidence:v1:alpha:overview:${symbol}`, this.write, async () => {
      const payload = await fetchJson<AlphaOverviewPayload>(alphaUrl(this.apiKey, "OVERVIEW", symbol));
      assertAlphaPayload(payload);
      if (!payload.Symbol) throw new Error("Alpha Vantage overview was incomplete");
      const revenue = numberValue(payload.RevenueTTM);
      const grossProfit = numberValue(payload.GrossProfitTTM);
      const asOf = payload.LatestQuarter ?? new Date().toISOString().slice(0, 10);
      return {
        symbol,
        fiscalPeriod: asOf,
        revenueGrowthPct: percentage(payload.QuarterlyRevenueGrowthYOY),
        epsGrowthPct: percentage(payload.QuarterlyEarningsGrowthYOY),
        operatingMarginPct: percentage(payload.OperatingMarginTTM),
        grossMarginPct: revenue && grossProfit ? Math.round((grossProfit / revenue) * 10_000) / 100 : undefined,
        revenue,
        grossProfit,
        marketCapitalization: numberValue(payload.MarketCapitalization),
        returnOnEquityPct: percentage(payload.ReturnOnEquityTTM),
        provenance: provenance(this.name, asOf),
      } satisfies NormalizedFundamentals;
    });
    return result.cached ? withCachedProvenance(result.value) : result.value;
  }

  private async earnings(symbol: string): Promise<NormalizedEarnings[]> {
    const result = await cachedValue(this.cache, `evidence:v1:alpha:earnings:${symbol}`, this.write, async () => {
      const payload = await fetchJson<AlphaEarningsPayload>(alphaUrl(this.apiKey, "EARNINGS", symbol));
      assertAlphaPayload(payload);
      return (payload.quarterlyEarnings ?? []).slice(0, 8).flatMap((item) => {
        if (!item.fiscalDateEnding) return [];
        return [{
          symbol,
          fiscalDateEnding: item.fiscalDateEnding,
          reportedDate: item.reportedDate,
          reportedEps: numberValue(item.reportedEPS),
          estimatedEps: numberValue(item.estimatedEPS),
          surprisePct: numberValue(item.surprisePercentage),
          provenance: provenance(this.name, item.reportedDate ?? item.fiscalDateEnding),
        } satisfies NormalizedEarnings];
      });
    });
    return result.cached ? result.value.map(withCachedProvenance) : result.value;
  }

  private async news(symbol: string): Promise<NormalizedNewsItem[]> {
    const result = await cachedValue(this.cache, `evidence:v1:alpha:news:${symbol}`, this.write, async () => {
      const payload = await fetchJson<AlphaNewsPayload>(alphaUrl(this.apiKey, "NEWS_SENTIMENT", symbol));
      assertAlphaPayload(payload);
      return (payload.feed ?? []).slice(0, 10).flatMap((item) => {
        if (!item.title || !item.url) return [];
        const publishedAt = alphaTimestamp(item.time_published);
        const tickerScore = item.ticker_sentiment?.find((entry) => entry.ticker === symbol)?.ticker_sentiment_score;
        return [{
          id: `alpha-${symbol}-${encodeURIComponent(item.url).slice(-80)}`,
          symbol,
          title: item.title,
          url: item.url,
          source: item.source ?? "Alpha Vantage news feed",
          publishedAt,
          summary: item.summary ?? "",
          sentiment: numberValue(tickerScore) ?? numberValue(item.overall_sentiment_score),
          provenance: provenance(this.name, publishedAt),
        } satisfies NormalizedNewsItem];
      });
    });
    return result.cached ? result.value.map(withCachedProvenance) : result.value;
  }
}

interface SecTickerEntry { cik_str?: number; ticker?: string; title?: string }
interface SecSubmissionsPayload {
  cik?: string;
  filings?: { recent?: { accessionNumber?: string[]; filingDate?: string[]; reportDate?: string[]; form?: string[]; primaryDocument?: string[] } };
}

export class SecEdgarProvider implements CompanyEvidenceProvider {
  readonly name = "SEC EDGAR";

  constructor(private readonly userAgent: string, private readonly cache: KVNamespace, private readonly write: CacheWriter) {}

  async load(symbol: string): Promise<Partial<CompanyEvidence>> {
    const normalized = symbol.toUpperCase();
    const cik = await this.cikFor(normalized);
    if (!cik) return { symbol: normalized, filings: [] };
    const key = `evidence:v1:sec:filings:${normalized}`;
    const result = await cachedValue(this.cache, key, this.write, async () => {
      const padded = cik.padStart(10, "0");
      const payload = await fetchJson<SecSubmissionsPayload>(new URL(`https://data.sec.gov/submissions/CIK${padded}.json`), { "User-Agent": this.userAgent });
      const recent = payload.filings?.recent;
      return (recent?.accessionNumber ?? []).flatMap((accessionNumber, index) => {
        const form = recent?.form?.[index];
        const filedAt = recent?.filingDate?.[index];
        const primaryDocument = recent?.primaryDocument?.[index];
        if (!accessionNumber || !form || !filedAt || !primaryDocument || !/^(10-[KQ]|8-K|20-F|6-K)$/.test(form)) return [];
        const accessionPath = accessionNumber.replaceAll("-", "");
        return [{
          symbol: normalized,
          accessionNumber,
          form,
          filedAt,
          reportDate: recent?.reportDate?.[index],
          primaryDocument,
          url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionPath}/${primaryDocument}`,
          provenance: provenance(this.name, filedAt),
        } satisfies NormalizedSecFiling];
      }).slice(0, 12);
    });
    return { symbol: normalized, filings: result.cached ? result.value.map(withCachedProvenance) : result.value };
  }

  private async cikFor(symbol: string): Promise<string | undefined> {
    const cached = await this.cache.get<Record<string, string>>("evidence:v1:sec:ticker-map", "json");
    if (cached) return cached[symbol];
    const payload = await fetchJson<Record<string, SecTickerEntry>>(new URL("https://www.sec.gov/files/company_tickers.json"), { "User-Agent": this.userAgent });
    const mapping = Object.fromEntries(Object.values(payload).flatMap((entry) => entry.ticker && entry.cik_str ? [[entry.ticker.toUpperCase(), String(entry.cik_str)]] : []));
    this.write(this.cache.put("evidence:v1:sec:ticker-map", JSON.stringify(mapping), { expirationTtl: SEC_TICKERS_TTL_SECONDS }).catch((error) => {
      console.error(JSON.stringify({ event: "sec_ticker_cache_write_failed", error: String(error) }));
    }));
    return mapping[symbol];
  }
}

export async function loadCompanyEvidence(symbol: string, providers: CompanyEvidenceProvider[]): Promise<CompanyEvidence> {
  const normalized = symbol.toUpperCase();
  const settled = await Promise.allSettled(providers.map((provider) => provider.load(normalized)));
  const bundle: CompanyEvidence = { symbol: normalized, earnings: [], filings: [], news: [] };
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(JSON.stringify({ event: "evidence_provider_failed", provider: providers[index]?.name, symbol: normalized, error: String(result.reason) }));
      return;
    }
    if (result.value.fundamentals) bundle.fundamentals = result.value.fundamentals;
    if (result.value.earnings) bundle.earnings.push(...result.value.earnings);
    if (result.value.filings) bundle.filings.push(...result.value.filings);
    if (result.value.news) bundle.news.push(...result.value.news);
  });
  return bundle;
}
