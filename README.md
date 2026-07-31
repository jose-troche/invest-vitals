# Invest Vitals

Invest Vitals is a calm, evidence-first dashboard for long-term investors. It combines performance, fundamentals, valuation, momentum, thesis evidence, and material news to answer one question quickly: **is this investment becoming stronger or weaker?**

The v1 is a working, responsive product with a transparent health model, live or cached market prices and return history, a browser-persisted watchlist, company comparisons, thesis-aware alerts, and a deterministic analyst assistant. Baseline fundamentals, valuation, thesis, and news are clearly distinguished from fresh market data.

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

The dashboard greeting uses the browser's local time and does not show a name by default. To configure one at build time:

```bash
cp apps/web/.env.example apps/web/.env
# Set VITE_USER_NAME in apps/web/.env
```

To add a ticker, open **Watchlist**, type a ticker or company name, and select a search result. The symbol list is saved in that browser's `localStorage`; market quotes are retrieved by the Worker and cached in KV.

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
- Prices and adjusted return history come from Yahoo Finance's unofficial chart endpoints and are cached for 15 minutes. Provider failures are shown using the clearly labeled baseline fallback.
- Fundamentals, valuation, thesis, news, and holding quantities remain baseline fixtures; the UI labels the resulting dataset as mixed.
- D1 tables cover portfolios, holdings, watchlists, price history, earnings, news, alerts, theses, and summaries for future authenticated accounts.
- KV is reserved for provider-response caching; cron is configured for weekday refresh orchestration.

See [architecture.md](docs/architecture.md) for the extension path to live providers, Workers AI, and account sync.
