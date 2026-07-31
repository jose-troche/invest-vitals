import { companies, dashboardData, findCompany, type Company, type ComparisonResult, type WatchlistResponse } from "@invest-vitals/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { answerQuestion } from "./assistant";
import { createDashboard, enrichCompany, getMarketSnapshot, searchMarket, toWatchlistQuote } from "./market-provider";

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
  requestId: context.get("requestId"),
}));

function backgroundWriter(context: { executionCtx: { waitUntil(promise: Promise<unknown>): void } }) {
  return (promise: Promise<unknown>) => context.executionCtx.waitUntil(promise);
}

async function enrichKnownCompanies(cache: KVNamespace, write: (promise: Promise<unknown>) => void): Promise<Company[]> {
  return Promise.all(companies.map(async (company) => {
    try {
      return enrichCompany(company, await getMarketSnapshot(cache, company.symbol, write));
    } catch (error) {
      console.warn(JSON.stringify({ event: "market_data_fallback", symbol: company.symbol, error: String(error) }));
      return company;
    }
  }));
}

app.get("/dashboard", async (context) => {
  if (!context.env?.CACHE) return context.json(dashboardData);
  const enriched = await enrichKnownCompanies(context.env.CACHE, backgroundWriter(context));
  return context.json(createDashboard(dashboardData, enriched));
});

app.get("/companies", async (context) => {
  if (!context.env?.CACHE) return context.json({ companies, dataMode: "illustrative" });
  return context.json({ companies: await enrichKnownCompanies(context.env.CACHE, backgroundWriter(context)), dataMode: "mixed" });
});

app.get("/companies/:symbol", async (context) => {
  const company = findCompany(context.req.param("symbol"));
  if (!company) return context.json({ error: "Company not found" }, 404);
  if (!context.env?.CACHE) return context.json(company);
  try {
    const snapshot = await getMarketSnapshot(context.env.CACHE, company.symbol, backgroundWriter(context));
    return context.json(enrichCompany(company, snapshot));
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
        return enrichCompany(company, await getMarketSnapshot(context.env.CACHE, company.symbol, backgroundWriter(context)));
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
  return context.json(answerQuestion(body.question.trim()));
});

app.notFound((context) => context.json({ error: "API route not found" }, 404));

app.onError((error, context) => {
  console.error(JSON.stringify({ event: "api_error", requestId: context.get("requestId"), error: String(error) }));
  return context.json({ error: "Unexpected API error", requestId: context.get("requestId") }, 500);
});

async function scheduledRefresh(env: Env): Promise<void> {
  const refreshedAt = new Date().toISOString();
  const writes: Promise<unknown>[] = [];
  await Promise.all(companies.map((company) => getMarketSnapshot(env.CACHE, company.symbol, (promise) => writes.push(promise)).catch((error) => {
    console.warn(JSON.stringify({ event: "scheduled_symbol_failed", symbol: company.symbol, error: String(error) }));
  })));
  await Promise.all(writes);
  await env.CACHE.put("refresh:last-success", refreshedAt, { expirationTtl: 60 * 60 * 24 * 7 });
  console.log(JSON.stringify({ event: "scheduled_refresh", refreshedAt, mode: "mixed" }));
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(scheduledRefresh(env));
  },
} satisfies ExportedHandler<Env>;
