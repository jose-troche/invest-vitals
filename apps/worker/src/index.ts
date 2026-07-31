import { companies, dashboardData, findCompany, type AlertItem, type AlertTransition, type Company, type CompanyEvidence, type ComparisonResult, type MarketSnapshot, type WatchlistResponse } from "@invest-vitals/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { answerQuestion } from "./assistant";
import { applyEvidence } from "./evidence-enrichment";
import { AlphaVantageProvider, loadCompanyEvidence, SecEdgarProvider, type CompanyEvidenceProvider } from "./evidence-provider";
import { createDashboard, enrichCompany, getMarketSnapshot, searchMarket, toWatchlistQuote } from "./market-provider";
import { loadCompanyHistory, loadLatestEvidence, loadRecentTransitions, persistRefresh } from "./persistence";
import { answerWithWorkersAi } from "./workers-ai";

type Bindings = Env;
type AppVariables = { requestId: string };

export const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>().basePath("/api");

app.use("*", async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  await next();
  context.header("X-Request-Id", requestId);
  context.header("Cache-Control", "no-store");
});

app.use("*", cors({ origin: (origin) => origin || "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (context) => context.json({
  ok: true,
  service: "invest-vitals",
  dataMode: context.env?.CACHE ? "mixed" : "illustrative",
  marketProvider: "Yahoo Finance chart API (unofficial)",
  primaryEvidence: {
    alphaVantage: Boolean(optionalBinding(context.env, "ALPHA_VANTAGE_API_KEY")),
    secEdgar: Boolean(optionalBinding(context.env, "SEC_USER_AGENT")),
  },
  workersAi: Boolean(context.env?.AI),
  requestId: context.get("requestId"),
}));

function backgroundWriter(context: { executionCtx: { waitUntil(promise: Promise<unknown>): void } }) {
  return (promise: Promise<unknown>) => context.executionCtx.waitUntil(promise);
}

function optionalBinding(env: Env | undefined, name: string): string | undefined {
  if (!env) return undefined;
  const value = Reflect.get(env, name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function evidenceProviders(env: Env, write: (promise: Promise<unknown>) => void): CompanyEvidenceProvider[] {
  const providers: CompanyEvidenceProvider[] = [];
  const alphaKey = optionalBinding(env, "ALPHA_VANTAGE_API_KEY");
  const secUserAgent = optionalBinding(env, "SEC_USER_AGENT");
  if (alphaKey) providers.push(new AlphaVantageProvider(alphaKey, env.CACHE, write));
  if (secUserAgent) providers.push(new SecEdgarProvider(secUserAgent, env.CACHE, write));
  return providers;
}

function mergeEvidence(stored: CompanyEvidence, refreshed: CompanyEvidence): CompanyEvidence {
  return {
    symbol: refreshed.symbol,
    fundamentals: refreshed.fundamentals ?? stored.fundamentals,
    earnings: refreshed.earnings.length > 0 ? refreshed.earnings : stored.earnings,
    filings: refreshed.filings.length > 0 ? refreshed.filings : stored.filings,
    news: refreshed.news.length > 0 ? refreshed.news : stored.news,
  };
}

function transitionToAlert(transition: AlertTransition, sourceCompanies: Company[]): AlertItem {
  return {
    id: transition.id,
    symbol: transition.symbol,
    company: sourceCompanies.find((company) => company.symbol === transition.symbol)?.name ?? transition.symbol,
    severity: transition.severity,
    title: transition.title,
    reason: transition.reason,
    scoreChange: transition.previousValue ? `${transition.previousValue} → ${transition.currentValue}` : undefined,
    time: transition.createdAt,
    read: false,
  };
}

async function storedEvidence(db: D1Database, symbol: string): Promise<CompanyEvidence> {
  try {
    return await loadLatestEvidence(db, symbol);
  } catch (error) {
    console.warn(JSON.stringify({ event: "evidence_history_unavailable", symbol, error: String(error) }));
    return { symbol, earnings: [], filings: [], news: [] };
  }
}

interface EnrichedCompanyResult { company: Company; market?: MarketSnapshot; evidence: CompanyEvidence }

async function enrichKnownCompanies(env: Env, write: (promise: Promise<unknown>) => void): Promise<EnrichedCompanyResult[]> {
  return Promise.all(companies.map(async (company) => {
    const evidence = await storedEvidence(env.DB, company.symbol);
    try {
      const market = await getMarketSnapshot(env.CACHE, company.symbol, write);
      return { company: applyEvidence(enrichCompany(company, market), evidence), market, evidence };
    } catch (error) {
      console.warn(JSON.stringify({ event: "market_data_fallback", symbol: company.symbol, error: String(error) }));
      return { company: applyEvidence(company, evidence), evidence };
    }
  }));
}

app.get("/dashboard", async (context) => {
  if (!context.env?.CACHE) return context.json(dashboardData);
  const enriched = await enrichKnownCompanies(context.env, backgroundWriter(context));
  const dashboard = createDashboard(dashboardData, enriched.map((item) => item.company));
  try {
    const transitions = await loadRecentTransitions(context.env.DB, 10);
    if (transitions.length > 0) dashboard.alerts = transitions.map((transition) => transitionToAlert(transition, dashboard.companies));
  } catch (error) {
    console.warn(JSON.stringify({ event: "alert_history_unavailable", error: String(error) }));
  }
  return context.json(dashboard);
});

app.get("/companies", async (context) => {
  if (!context.env?.CACHE) return context.json({ companies, dataMode: "illustrative" });
  const enriched = await enrichKnownCompanies(context.env, backgroundWriter(context));
  return context.json({ companies: enriched.map((item) => item.company), dataMode: "mixed" });
});

app.get("/companies/:symbol", async (context) => {
  const company = findCompany(context.req.param("symbol"));
  if (!company) return context.json({ error: "Company not found" }, 404);
  if (!context.env?.CACHE) return context.json(company);
  try {
    const snapshot = await getMarketSnapshot(context.env.CACHE, company.symbol, backgroundWriter(context));
    const evidence = await storedEvidence(context.env.DB, company.symbol);
    return context.json(applyEvidence(enrichCompany(company, snapshot), evidence));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_data_fallback", symbol: company.symbol, error: String(error) }));
    return context.json(company);
  }
});

app.get("/compare", async (context) => {
  const requested = (context.req.query("symbols") ?? "MSFT,GOOGL,AMZN")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .slice(0, 3);
  const baseline = requested.map(findCompany).filter((company) => company !== undefined);
  const selected = context.env?.CACHE
    ? await Promise.all(baseline.map(async (company) => {
      try {
        const market = await getMarketSnapshot(context.env.CACHE, company.symbol, backgroundWriter(context));
        return applyEvidence(enrichCompany(company, market), await storedEvidence(context.env.DB, company.symbol));
      } catch {
        return company;
      }
    }))
    : baseline;
  if (selected.length < 2) return context.json({ error: "Select at least two valid symbols" }, 400);

  const winner = [...selected].sort((a, b) => b.health - a.health)[0];
  const result: ComparisonResult = {
    symbols: selected.map((company) => company.symbol),
    rows: [
      { label: "Health", values: Object.fromEntries(selected.map((company) => [company.symbol, company.health])), winner: winner?.symbol },
      { label: "Momentum", values: Object.fromEntries(selected.map((company) => [company.symbol, company.momentum])) },
      { label: "Revenue growth", values: Object.fromEntries(selected.map((company) => [company.symbol, company.fundamentals[0]?.value ?? "—"])) },
      { label: "Operating margin", values: Object.fromEntries(selected.map((company) => [company.symbol, company.fundamentals[2]?.value ?? "—"])) },
      { label: "Valuation", values: Object.fromEntries(selected.map((company) => [company.symbol, company.valuationLabel])) },
      { label: "Risk", values: Object.fromEntries(selected.map((company) => [company.symbol, company.risk])) },
      { label: "1-year return", values: Object.fromEntries(selected.map((company) => [company.symbol, `${company.performance[3]?.returnPct ?? 0}%`])) },
    ],
    conclusion: winner
      ? `${winner.name} has the strongest current combination of health and momentum. Compare that evidence with your own thesis; this is not a buy or sell recommendation.`
      : "Not enough data to compare.",
  };
  return context.json(result);
});

app.get("/history/:symbol", async (context) => {
  const symbol = context.req.param("symbol").toUpperCase();
  if (!findCompany(symbol)) return context.json({ error: "Company not found" }, 404);
  if (!context.env?.DB) return context.json({ symbol, history: [] });
  const limit = Number(context.req.query("limit") ?? 90);
  try {
    return context.json({ symbol, history: await loadCompanyHistory(context.env.DB, symbol, Number.isFinite(limit) ? limit : 90) });
  } catch (error) {
    console.warn(JSON.stringify({ event: "history_read_failed", symbol, error: String(error) }));
    return context.json({ symbol, history: [] });
  }
});

app.get("/transitions", async (context) => {
  if (!context.env?.DB) return context.json({ transitions: [] });
  try {
    return context.json({ transitions: await loadRecentTransitions(context.env.DB, 50) });
  } catch (error) {
    console.warn(JSON.stringify({ event: "transition_read_failed", error: String(error) }));
    return context.json({ transitions: [] });
  }
});

app.get("/search", async (context) => {
  const query = (context.req.query("q") ?? "").trim();
  if (query.length < 1) return context.json({ results: [], source: "Yahoo Finance chart API (unofficial)" });
  if (!context.env?.CACHE) return context.json({ results: [], source: "Unavailable in the isolated test environment" });
  try {
    return context.json({ results: await searchMarket(context.env.CACHE, query, backgroundWriter(context)), source: "Yahoo Finance chart API (unofficial)" });
  } catch (error) {
    console.warn(JSON.stringify({ event: "symbol_search_failed", query, error: String(error) }));
    return context.json({ error: "Ticker search is temporarily unavailable" }, 503);
  }
});

app.get("/watchlist", async (context) => {
  const symbols = [...new Set((context.req.query("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.^=-]{1,15}$/.test(symbol)))]
    .slice(0, 25);
  if (symbols.length === 0) return context.json({ quotes: [], unavailable: [], dataMode: "mixed" } satisfies WatchlistResponse);
  if (!context.env?.CACHE) return context.json({
    quotes: symbols.flatMap((symbol) => {
      const company = findCompany(symbol);
      if (!company) return [];
      return [{
        symbol: company.symbol, name: company.name, exchange: "Baseline", currency: "USD", price: company.price,
        previousClose: company.price / (1 + company.dayChangePct / 100), dayChangePct: company.dayChangePct,
        marketTime: dashboardData.generatedAt, performance: company.performance, annualReturns: company.annualReturns,
        momentumScore: company.momentumScore, momentum: company.momentum, momentumDirection: company.momentumDirection,
        marketData: dashboardData.marketData, accent: company.accent, health: company.health, healthLabel: company.healthLabel,
        healthDelta: company.healthDelta, keyChange: company.keyChange, hasCompanyDetails: true,
      }];
    }),
    unavailable: symbols.filter((symbol) => !findCompany(symbol)),
    dataMode: "illustrative",
  } satisfies WatchlistResponse);
  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      const snapshot = await getMarketSnapshot(context.env.CACHE, symbol, backgroundWriter(context));
      return { quote: toWatchlistQuote(snapshot, findCompany(symbol)) };
    } catch (error) {
      console.warn(JSON.stringify({ event: "watchlist_quote_failed", symbol, error: String(error) }));
      return { symbol };
    }
  }));
  return context.json({
    quotes: results.flatMap((result) => result.quote ? [result.quote] : []),
    unavailable: results.flatMap((result) => result.symbol ? [result.symbol] : []),
    dataMode: "mixed",
  } satisfies WatchlistResponse);
});

app.post("/assistant", async (context) => {
  const body: { question?: unknown } = await context.req.json<{ question?: unknown }>().catch(() => ({}));
  if (typeof body.question !== "string" || body.question.trim().length < 2) {
    return context.json({ error: "A question is required" }, 400);
  }
  const question = body.question.trim();
  if (!context.env?.CACHE || !context.env?.AI) return context.json({ ...answerQuestion(question), mode: "deterministic" as const });
  const enriched = await enrichKnownCompanies(context.env, backgroundWriter(context));
  const currentCompanies = enriched.map((item) => item.company);
  const fallback = answerQuestion(question, currentCompanies);
  const answer = await answerWithWorkersAi(context.env.AI, question, currentCompanies, fallback);
  return context.json(answer);
});

app.notFound((context) => context.json({ error: "API route not found" }, 404));

app.onError((error, context) => {
  console.error(JSON.stringify({ event: "api_error", requestId: context.get("requestId"), error: String(error) }));
  return context.json({ error: "Unexpected API error", requestId: context.get("requestId") }, 500);
});

async function scheduledRefresh(env: Env, scheduledTime: number): Promise<void> {
  const refreshedAt = new Date().toISOString();
  const writes: Promise<unknown>[] = [];
  const write = (promise: Promise<unknown>) => writes.push(promise);
  const providers = evidenceProviders(env, write);
  const selectedIndex = Math.max(0, Math.min(companies.length - 1, new Date(scheduledTime).getUTCDay() - 1));
  const selectedSymbol = companies[selectedIndex]?.symbol;
  const refreshedEvidence = selectedSymbol && providers.length > 0
    ? await loadCompanyEvidence(selectedSymbol, providers)
    : undefined;
  const results = await Promise.all(companies.map(async (company) => {
    try {
      const market = await getMarketSnapshot(env.CACHE, company.symbol, write);
      const stored = await storedEvidence(env.DB, company.symbol);
      const evidence = refreshedEvidence?.symbol === company.symbol ? mergeEvidence(stored, refreshedEvidence) : stored;
      const enriched = applyEvidence(enrichCompany(company, market), evidence);
      const transitions = await persistRefresh(env.DB, enriched, market, evidence);
      return { symbol: company.symbol, transitions: transitions.length };
    } catch (error) {
      console.warn(JSON.stringify({ event: "scheduled_symbol_failed", symbol: company.symbol, error: String(error) }));
      return { symbol: company.symbol, transitions: 0 };
    }
  }));
  await Promise.all(writes);
  await env.CACHE.put("refresh:last-success", refreshedAt, { expirationTtl: 60 * 60 * 24 * 7 });
  console.log(JSON.stringify({ event: "scheduled_refresh", refreshedAt, mode: "mixed", evidenceSymbol: selectedSymbol, providers: providers.map((provider) => provider.name), results }));
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(scheduledRefresh(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
