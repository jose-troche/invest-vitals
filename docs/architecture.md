# Invest Vitals architecture

## Runtime shape

Invest Vitals is an npm-workspaces monorepo that deploys as one Cloudflare Worker. The React bundle is uploaded through Workers Static Assets; only `/api/*` requests invoke Hono first. Unknown navigation paths fall back to `index.html`, so company and product routes work on refresh.

```text
Browser
  ├─ React SPA ── localStorage watchlist
  └─ /api/* ───── Hono Worker
                     ├─ shared scoring/domain package
                     ├─ KV provider cache
                     ├─ D1 history and future account data
                     └─ weekday scheduled refresh
```

This stays within Cloudflare's free-tier product set: Workers, Static Assets, KV, and D1. No Durable Object, queue, paid database, or third-party auth service is required for v1.

## Boundaries

`packages/invest-domain` owns the stable contracts and deterministic calculations. Health is built from visible weighted components; momentum combines 1-, 3-, 6-, and 12-month returns. The Worker owns request handling, provider orchestration, cache/persistence bindings, scheduled jobs, and assistant grounding. The web app owns local workspace state and presentation.

The current fixtures intentionally keep the full experience available without API keys. `dataMode: "illustrative"` travels with the API contract and is shown in the UI. A future provider implementation should never silently substitute stale or demo data while claiming to be live.

## Live-data extension

1. Add provider adapters behind normalized price, fundamentals, earnings, SEC, and news interfaces.
2. Cache rate-limited responses in KV with source timestamps and persist normalized history in D1.
3. Recompute transparent scores after each refresh and store only material alert transitions.
4. Add a Workers AI binding downstream of normalized evidence. Preserve the deterministic assistant as the fallback and validate model output before returning it.
5. Add Cloudflare Access or another auth provider. Migrate the local watchlist on consent, associate D1 records with the verified identity, and keep anonymous local mode available.

Secrets belong in `wrangler secret put`, never in source or `wrangler.jsonc`.

## Verification

`npm run check` runs strict TypeScript across all workspaces, unit/API tests, and the production build. `npm run deploy:dry` additionally validates Worker bundling, Static Assets, and binding configuration. The migration can be applied to Wrangler's local D1 database, and the local scheduled endpoint exercises the KV refresh marker.
