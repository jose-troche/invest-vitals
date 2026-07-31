# Invest Vitals architecture

## Runtime shape

Invest Vitals is an npm-workspaces monorepo that deploys as one Cloudflare Worker. The React bundle is uploaded through Workers Static Assets; only `/api/*` requests invoke Hono first. Unknown navigation paths fall back to `index.html`, so company and product routes work on refresh.

```text
Browser
  ├─ React SPA ── localStorage watchlist
  └─ /api/* ───── Hono Worker
                     ├─ unofficial Yahoo chart/search adapter
                     ├─ shared scoring/domain package
                     ├─ KV provider cache
                     ├─ D1 history and future account data
                     └─ weekday scheduled refresh
```

This stays within Cloudflare's free-tier product set: Workers, Static Assets, KV, and D1. No Durable Object, queue, paid database, or third-party auth service is required for v1.

## Boundaries

`packages/invest-domain` owns the stable contracts and deterministic calculations. Health is built from visible weighted components; momentum combines 1-, 3-, 6-, and 12-month returns. The Worker owns request handling, provider orchestration, cache/persistence bindings, scheduled jobs, and assistant grounding. The web app owns local workspace state and presentation.

The provider adapter normalizes Yahoo Finance's unofficial chart and search responses without requiring an API key. Adjusted price history and current quotes are cached in KV for 15 minutes and carry source, market timestamp, fetch timestamp, and `live`/`cached`/`fallback` state through the shared contract. Provider failures preserve the full experience with a clearly labeled baseline; they never silently claim fallback data is live.

The dataset is intentionally mixed. Market price, daily move, momentum, and return history come from the provider. Fundamentals, valuation, thesis, news, holdings, and alerts remain baseline fixtures. `dataMode: "mixed"` and the provenance note make this boundary visible in the UI.

## Future data extensions

1. Add key-backed primary adapters for fundamentals, earnings, SEC, and news behind normalized interfaces; keep the current price adapter as fallback.
2. Persist normalized history in D1 when longer retention or alert evaluation requires it.
3. Recompute transparent scores after each refresh and store only material alert transitions.
4. Add a Workers AI binding downstream of normalized evidence. Preserve the deterministic assistant as the fallback and validate model output before returning it.
5. Add Cloudflare Access or another auth provider. Migrate the local watchlist on consent, associate D1 records with the verified identity, and keep anonymous local mode available.

Secrets belong in `wrangler secret put`, never in source or `wrangler.jsonc`.

## Verification

`npm run check` runs strict TypeScript across all workspaces, unit/API tests, and the production build. `npm run deploy:dry` additionally validates Worker bundling, Static Assets, and binding configuration. The migration can be applied to Wrangler's local D1 database, and the local scheduled endpoint exercises the KV refresh marker.
