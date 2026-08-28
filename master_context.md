# Master Context (for agents working on this repo)

This file is written for an AI agent about to make changes here. Read it before touching code. For a human-readable narrative overview, see [APP_OVERVIEW.md](APP_OVERVIEW.md) instead — this file is the terse, gotcha-first companion.

## 1. Orientation

This is a Shopify embedded admin app + theme app extension implementing a customer wishlist ("save for later") for Century Martial Arts storefronts. Config name **WishlistFu**, handle `save-for-later-wishlist`. It behaves like an **internal Century tool**, not a general App Store app — the admin dashboard hardcodes and reports on `centuryweb.myshopify.com`, `century-us-wholesale.myshopify.com`, and `gameness.myshopify.com` with no per-shop access scoping, even though `shopify.app.toml` declares `AppDistribution.AppStore`. Treat that mismatch as unresolved — don't assume either direction without asking.

All real custom logic lives in exactly four places. Everything else in `app/` is unmodified Shopify Remix template boilerplate:
- `app/routes/app._index.jsx` — the one admin screen (read-only analytics dashboard)
- `app/routes/api.wishlist.jsx` — the wishlist REST API (public, consumed by the theme extension)
- `app/routes/wishlist-page.jsx` — an unfinished/unstyled scaffold route, superseded by the theme extension's listing block; treat as dead code unless told otherwise
- `extensions/wishlist-icon/` — the theme app extension (product-page, listing, and shared grid/cart embed blocks) that shoppers actually interact with

## 2. Commands

```
npm run dev       # shopify app dev — CLI tunnel + hot reload
npm run build      # remix vite:build
npm run deploy     # shopify app deploy — ships app config + theme extension
npm run setup       # prisma generate && prisma migrate deploy
npm run lint        # eslint
npm run start       # remix-serve ./build/server/index.js (prod)
```

**There is no test suite in this repo** — no test framework, no test files were found in either full-repo exploration pass. Do not assume `npm test` works or that changes are covered by tests. If asked to add tests, that's new infrastructure, not a fix to something broken.

## 3. Conventions to respect

- **JS/JSX, not TypeScript** — despite `tsconfig.json` and `@types/*` deps existing, all actual source is `.js`/`.jsx`. Don't start introducing `.ts`/`.tsx` files without raising it first; it'd be an inconsistent, unrequested convention change.
- **File-based routing** — `app/routes.js` uses `flatRoutes()` from `@remix-run/fs-routes`. New routes are created by adding a correctly-named file under `app/routes/`, not by editing a route config.
- **Prisma singleton** — always import `db` from `app/db.server.js`; never instantiate a new `PrismaClient()` elsewhere (the singleton exists specifically to avoid connection exhaustion during Vite HMR in dev).
- **`vite.config.js` is the live build config.** `remix.config.js` is a legacy CJS config left over from before the Vite migration — don't edit it expecting it to take effect.

## 4. Data model facts (`prisma/schema.prisma`)

- `Wishlist` is the only real business table: `id, customerId, productId, variantId, notes, has, needs, shop, createdAt` — **every field is nullable, no FKs, no unique constraints.** Any dedup/integrity guarantees you need have to be enforced in application code (as `api.wishlist.jsx` currently does, imperfectly — see §5).
- Items are keyed by **`variantId`**, not `productId` — `productId` rides along but isn't the identity.
- `customerId` is a Shopify customer ID — it's customer PII. Keep that in mind for anything you add that touches this table (see §7).
- `Settings` model exists in the schema but is **not read or written anywhere in the codebase.** It's dead/unused — don't build a feature on top of it assuming it's wired up; verify first.
- Only one migration exists (`20250101000000_init_postgresql`) — this is a young, squashed schema history, not a long-lived one.

## 5. API gotchas — `app/routes/api.wishlist.jsx`

Know these exact behaviors before modifying this route; they're easy to break further or "fix" incorrectly without noticing:

- **POST silently drops `has`/`needs`.** The action reads them from the form but only passes `notes` to `create()`. This looks like a bug, not a design choice — confirm intent with the user before "fixing," since a fix changes stored data shape going forward.
- **PUT's `where` is not scoped by `shop`** — it matches on `customerId` + `variantId` only. If the same customer ID existed under multiple shops with the same variant ID, one PUT would update rows across shops. Scope-check any change you make here.
- **Missing required fields return HTTP 200** with `{ ok: false, message: "Missing required fields" }` — not a 4xx. Don't write client code (or reason about existing client code) assuming HTTP status reflects success/failure; check the JSON body.
- **CORS is wide open** (`Access-Control-Allow-Origin: *`) — intentional, because the theme extension calls this route directly from arbitrary storefront pages. Don't tighten this without confirming it won't break the storefront blocks.
- All writes require `customerId`, `variantId`, `shop`. `DELETE` additionally requires `productId` to match the theme extension's actual call shape — don't drop that requirement without updating the caller.

## 6. Theme extension gotchas — `extensions/wishlist-icon/`

- The app's base URL (`https://wishlist-remix-app.onrender.com`) is **hardcoded directly in the Liquid/JS** in all three active extension blocks — it is not read from a theme setting, app proxy, or env-driven template variable. Changing hosting means editing and redeploying the extension itself, not flipping an env var.
- `wishlist-list.liquid` makes its own **client-side, unauthenticated Storefront GraphQL calls** directly to `https://${shopDomain}/api/2025-07/graphql.json` to resolve live price/availability/title — this traffic never touches this app's own API/DB. If prices/availability look wrong, check this path, not `api.wishlist.jsx`.
- `wishlist-icon.liquid` uses Alpine.js from a CDN; `wishlist-list.liquid` uses vanilla JS. There's no shared JS module between them — duplicated logic (e.g. fetch calls) lives in both files independently.
- `wishlist-grid-embed.liquid` owns the shared pixel-heart controller used by product grids, cart line items, and wishlist header navigation. The theme supplies only inert product/variant/title metadata and mount hooks; keep wishlist API behavior and heart state in `wishlist-grid.js`.
- The extension stylesheet hides `.wishlist-header-heart` and `[data-wishlist-header-link]` inside `[data-site-header]` below 768px. Keep that responsive header behavior app-owned so desktop, compressed, and mobile injection containers stay consistent across storefront themes.
- Cart hearts mount only inside `cart-element[data-cart-page]`, use `data-wishlist-cart-item` and `data-wishlist-cart-actions`, and must remount after AJAX cart replacements. The cart drawer intentionally remains unchanged.
- Wishlist identity remains customer-based; there is no cookie- or localStorage-backed guest wishlist. The product-page block is gated by `{% if customer %}`, while shared grid/cart hearts render for guests and send activation through the configured Shopify login URL.
- `snippets/stars.liquid` and `assets/thumbs-up.png` are unused leftovers, not part of the wishlist feature — don't wire new work through them assuming they're active.

## 7. Deployment — confirm before assuming a target

The repo contains **two conflicting deployment stories**:
- Render.com + Postgres: `Dockerfile` + `docker-start` (`prisma migrate deploy` → `remix-serve`), `.env`'s `DATABASE_URL`, and `shopify.app.toml`'s `application_url` all point here. This looks current.
- Fly.io + SQLite/Litestream: `.github/workflows/fly-deploy.yml`, `litestream.yml`, `dbsetup.js`, `prisma/dev.sqlite`, and the `@flydotio/litestream` dependency are all still present, but there's **no `fly.toml`** in the repo, and the schema provider is now `postgresql`, not `sqlite`. This looks like a leftover from an earlier architecture.

**Do not assume either is authoritative.** If a task involves deploy config, env vars, or the database connection, confirm the live target with the user first rather than inferring it from file presence — the files present are not fully consistent with each other.

## 8. Compliance/data gaps — know before extending customer-data features

- No GDPR mandatory webhooks are registered (`customers/data_request`, `customers/redact`, `shop/redact` are all absent from `shopify.app.toml` and `app/routes/`), despite `Wishlist.customerId` being customer PII.
- `webhooks.app.uninstalled.jsx` deletes `Session` rows on uninstall but **does not touch `Wishlist` rows** — wishlist data persists indefinitely after a shop uninstalls the app.

If you're asked to add anything that stores more customer data, add new webhook handling, or touch uninstall/redaction flows, raise this existing gap explicitly rather than building further on top of it silently.

## 9. Where to look first

| Task | Start here |
|---|---|
| Change the admin dashboard | `app/routes/app._index.jsx` |
| Add/change a wishlist API behavior | `app/routes/api.wishlist.jsx` |
| Change the "Add to Wishlist" button | `extensions/wishlist-icon/blocks/wishlist-icon.liquid` |
| Change the wishlist listing page / Notes-Has-Needs modal | `extensions/wishlist-icon/blocks/wishlist-list.liquid` |
| Change the data model | `prisma/schema.prisma` + new migration under `prisma/migrations/` |
| Change auth/session/webhook registration | `app/shopify.server.js`, `shopify.app.toml` |
| Add a new admin route | new file under `app/routes/` (flat-routes naming) |
| Investigate deploy behavior | `Dockerfile`, `shopify.web.toml`, and confirm with the user per §7 before changing |
