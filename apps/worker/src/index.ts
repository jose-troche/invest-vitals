import { companies, dashboardData, findCompany, type ComparisonResult } from "@invest-vitals/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { answerQuestion } from "./assistant";

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
  dataMode: "illustrative",
  requestId: context.get("requestId"),
}));

app.get("/dashboard", (context) => context.json(dashboardData));

app.get("/companies", (context) => context.json({ companies, dataMode: "illustrative" }));

app.get("/companies/:symbol", (context) => {
  const company = findCompany(context.req.param("symbol"));
  if (!company) return context.json({ error: "Company not found" }, 404);
  return context.json(company);
});

app.get("/compare", (context) => {
  const requested = (context.req.query("symbols") ?? "MSFT,GOOGL,AMZN")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .slice(0, 3);
  const selected = requested.map(findCompany).filter((company) => company !== undefined);
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
  await env.CACHE.put("refresh:last-success", refreshedAt, { expirationTtl: 60 * 60 * 24 * 7 });
  console.log(JSON.stringify({ event: "scheduled_refresh", refreshedAt, mode: "illustrative" }));
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
