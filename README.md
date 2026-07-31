# Invest Vitals

Invest Vitals is a calm, evidence-first dashboard for long-term investors. It combines performance, fundamentals, valuation, momentum, thesis evidence, and material news to answer one question quickly: **is this investment becoming stronger or weaker?**

The v1 is a working, responsive product demonstration with a transparent health model, a browser-persisted watchlist, company comparisons, thesis-aware alerts, and a deterministic analyst assistant. All financial data is explicitly labeled illustrative; no live-market claim is implied.

## Monorepo

```text
apps/
  web/              React, Vite, Tailwind CSS, shadcn-style UI
  worker/           Hono API, Worker entrypoint, D1 migrations, cron
packages/
  invest-domain/    Shared contracts, fixtures, and scoring rules
```

The production build deploys the API and web assets together as one Cloudflare Worker. Cloudflare automatically provisions the free-tier D1 database and KV namespace on first deploy. The watchlist uses `localStorage` today, so no authentication or personal data backend is required.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run cf-types
npm run build
npm run dev
```

Open `http://localhost:8787`. The Worker serves both the SPA and `/api/*` routes.

Useful commands:

```bash
npm run check          # typecheck, tests, production build
npm run deploy:dry     # validate the Cloudflare upload and bindings
npm run deploy         # deploy the single Worker project
```

Apply the D1 schema locally with:

```bash
cd apps/worker
npx wrangler d1 migrations apply invest-vitals-db --local
```

## Data and product boundaries

- Scores are weighted and fully visible; they are not a black box.
- The assistant is deterministic and grounded in the same visible evidence. It never predicts prices or emits buy/sell calls.
- Current company and market values are illustrative fixtures. Replace the provider layer before describing the data as live.
- D1 tables cover portfolios, holdings, watchlists, price history, earnings, news, alerts, theses, and summaries for future authenticated accounts.
- KV is reserved for provider-response caching; cron is configured for weekday refresh orchestration.

See [architecture.md](docs/architecture.md) for the extension path to live providers, Workers AI, and account sync.
