# Invest Vitals architecture

## Runtime shape

Invest Vitals is an npm-workspaces monorepo that deploys as one Cloudflare Worker. The React bundle is uploaded through Workers Static Assets; only `/api/*` requests invoke Hono first. Unknown navigation paths fall back to `index.html`, so company and product routes work on refresh.

```text
Browser
  ├─ React SPA ── localStorage watchlist
  └─ /api/* ───── Hono Worker
                     ├─ unofficial Yahoo chart/search adapter
                     ├─ Alpha Vantage + SEC EDGAR evidence adapters
                     ├─ shared scoring/domain package
                     ├─ KV provider cache
                     ├─ D1 evidence, score, market, and alert history
                     ├─ validated Workers AI explanation layer
                     └─ weekday post-market scheduled refresh
```

This stays within Cloudflare's free-tier product set: Workers, Static Assets, KV, and D1. No Durable Object, queue, paid database, or third-party auth service is required for v1.

## Boundaries

`packages/invest-domain` owns the stable contracts and deterministic calculations. Health is built from visible weighted components; momentum combines 1-, 3-, 6-, and 12-month returns. The Worker owns request handling, provider orchestration, cache/persistence bindings, scheduled jobs, and assistant grounding. The web app owns local workspace state and presentation.

The provider adapter normalizes Yahoo Finance's unofficial chart and search responses without requiring an API key. Adjusted price history and current quotes are cached in KV for 15 minutes and carry source, market timestamp, fetch timestamp, and `live`/`cached`/`fallback` state through the shared contract. Provider failures preserve the full experience with a clearly labeled baseline; they never silently claim fallback data is live.

The dataset is intentionally mixed. Market price, daily move, momentum, and return history come from the price provider. When configured, Alpha Vantage supplies normalized fundamentals, earnings, and news, while SEC EDGAR supplies normalized material filings. Valuation, thesis, and holdings remain baseline fixtures. `dataMode: "mixed"`, per-record provenance, and source badges keep this boundary visible.

## Future data extensions

- [x] Add primary adapters for fundamentals, earnings, SEC, and news behind normalized interfaces. Alpha Vantage uses `ALPHA_VANTAGE_API_KEY`; SEC EDGAR uses a fair-access `SEC_USER_AGENT`. Either can fail independently without hiding persisted/baseline evidence.
- [x] Persist normalized evidence, market snapshots, and health snapshots in D1. `/api/history/:symbol` exposes retained market/health points and `/api/transitions` exposes the transition log.
- [x] Recompute transparent health components after refresh and persist only health-band changes, score moves of at least three points, momentum-direction changes, or fundamental signal changes.
- [x] Run Workers AI downstream of the normalized evidence packet. JSON Mode is schema-validated and screened for direct trading instructions; every failure returns the deterministic answer instead.
- [ ] Add Cloudflare Access or another auth provider. Migrate the local watchlist on consent, associate D1 records with the verified identity, and keep anonymous local mode available.

The weekday `22:15 UTC` job refreshes market history for every tracked holding and rotates one company through the optional primary evidence adapters per run. This avoids placing free-provider quotas on the request path. D1 is the durable read path; KV remains the bounded response cache.

Workers AI uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with a compact evidence packet and constrained output. The returned JSON is not trusted until application validation succeeds. Anonymous questions and answers are not persisted; deterministic fallbacks are not presented as model output.

Secrets belong in `wrangler secret put`, never in source or `wrangler.jsonc`.

## Verification

`npm run check` runs strict TypeScript across all workspaces, unit/API tests, and the production build. `npm run deploy:dry` additionally validates Worker bundling, Static Assets, and binding configuration. The migration can be applied to Wrangler's local D1 database, and the local scheduled endpoint exercises the KV refresh marker.
