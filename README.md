# Invest Vitals

Invest Vitals is a calm, evidence-first dashboard for long-term investors. It combines performance, fundamentals, valuation, momentum, thesis evidence, and material news to answer one question quickly: **is this investment becoming stronger or weaker?**

The v1 is a working, responsive product with a transparent health model, live or cached market prices and return history, normalized primary evidence, a browser-persisted watchlist, company comparisons, persisted material alerts, and a validated Workers AI assistant with a deterministic fallback.

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

Primary evidence is optional. Without these secrets, the app continues using persisted evidence and clearly labeled baselines:

```bash
cd apps/worker
npx wrangler secret put ALPHA_VANTAGE_API_KEY
npx wrangler secret put SEC_USER_AGENT
```

For local provider work, copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` and fill in the values. `SEC_USER_AGENT` must contain an honest application identifier and monitored contact address. Alpha Vantage supplies normalized fundamentals, earnings, and news; SEC EDGAR supplies filing evidence. The weekday job rotates one company per run to stay conservative with provider quotas.

## Data and product boundaries

- Scores are weighted and fully visible; they are not a black box.
- Workers AI receives only normalized evidence and must return a schema-validated answer. Invalid, unavailable, or unsafe responses fall back to the deterministic assistant.
- Prices and adjusted return history come from Yahoo Finance's unofficial chart endpoints and are cached for 15 minutes. Provider failures are shown using the clearly labeled baseline fallback.
- Fundamentals, earnings, SEC filings, and news use persisted primary evidence when configured. Valuation, thesis, and holding quantities remain baseline fixtures and are labeled accordingly.
- D1 stores normalized provider evidence, market/health history, and material alert transitions in addition to the future account tables. Anonymous assistant questions and answers are not persisted.
- KV is reserved for provider-response caching; cron is configured for weekday refresh orchestration.

See [architecture.md](docs/architecture.md) for the data pipeline and the remaining account-sync extension.
