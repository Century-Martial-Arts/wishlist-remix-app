# Master context (for agents working on this repo)

Read this before changing code. Human-oriented docs: [README.md](README.md), [docs/architecture.md](docs/architecture.md), [docs/getting-started.md](docs/getting-started.md). Prefer those for full explanations; this file is gotcha-first.

## 1. Orientation

Shopify embedded admin app + theme app extension for Century Martial Arts wishlists ("save for later"). Config name **WishlistFu**, handle `save-for-later-wishlist`.

The admin dashboard aggregates wishlist rows across shops in one database (with a small display-name map for known Century stores). `shopify.server.js` sets `AppDistribution.AppStore`. Treat distribution vs internal-tool intent as unresolved — ask before changing either.

All real custom logic is in:

- `app/routes/app._index.jsx` — analytics dashboard
- `app/routes/api.wishlist.jsx` — public wishlist API
- `app/routes/wishlist-page.jsx` — unfinished scaffold; prefer the theme listing block
- `extensions/wishlist-icon/` — shopper UI (product, listing, shared grid/cart embed)

## 2. Commands

```text
npm run dev       # shopify app dev
npm run build     # remix vite:build
npm run deploy    # shopify app deploy (config + extension)
npm run setup     # prisma generate && prisma migrate deploy
npm run lint      # eslint
npm run start     # remix-serve ./build/server/index.js
```

No test suite / no `npm test` in this repo.

## 3. Conventions

- **JS/JSX**, not TypeScript source (despite `tsconfig.json`)
- Flat Remix routes via `app/routes.js` + `@remix-run/fs-routes`
- Prisma singleton from `app/db.server.js` only
- Live build config is `vite.config.js` (`remix.config.js` is legacy)

## 4. Data model

- `Wishlist`: `id, customerId, productId, variantId, notes, has, needs, shop, createdAt` — mostly nullable, no unique constraints
- Keyed by **variantId** for toggles
- `customerId` is PII
- `Settings` model unused
- One Postgres migration: `20250101000000_init_postgresql`

## 5. API gotchas (`api.wishlist.jsx`)

- POST parses `has`/`needs` but does not save them on create
- PUT `where` is `customerId` + `variantId` only (not `shop`)
- Missing required fields often return HTTP 200 with `{ ok: false, ... }`
- CORS is `*`
- Writes require `customerId`, `variantId`, `shop`; DELETE also matches `productId`

## 6. Theme extension gotchas

- Production app URL is **hardcoded** in the Liquid/JS blocks
- Listing uses client-side Storefront GraphQL (`/api/2025-07/graphql.json`) for live merchandising fields
- Shared hearts: `wishlist-grid.js` + theme `data-wishlist-*` hooks; cart page only (`cart-element[data-cart-page]`); header hearts hidden below 768px by extension CSS
- No guest wishlist persistence
- `stars.liquid` / `thumbs-up.png` unused

## 7. Deployment

Conflicting artifacts: Postgres + Dockerfile/`docker-start` + production `application_url` look current; Fly workflow + Litestream/SQLite helpers look leftover (no `fly.toml`). **Confirm the live host with the owner** before changing deploy paths. This repo is public — do not document secrets, internal admin URLs, or credentials in markdown.

## 8. Compliance gaps

- No GDPR mandatory webhooks registered
- Uninstall deletes `Session` only; `Wishlist` rows remain

## 9. Where to look first

| Task | Start here |
|---|---|
| Admin dashboard | `app/routes/app._index.jsx` |
| API behavior | `app/routes/api.wishlist.jsx` + `docs/api.md` |
| Product-page heart | `extensions/wishlist-icon/blocks/wishlist-icon.liquid` |
| Listing / notes | `extensions/wishlist-icon/blocks/wishlist-list.liquid` |
| Grid/cart/header | `blocks/wishlist-grid-embed.liquid`, `assets/wishlist-grid.js` |
| Schema | `prisma/schema.prisma` |
| Auth / webhooks | `app/shopify.server.js`, `shopify.app.toml` |
| Ship a change | `docs/getting-started.md`, `docs/deployment.md` |
