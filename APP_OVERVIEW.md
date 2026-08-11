# Wishlist App — Overview & Refresh

**App name:** WishlistFu (Shopify config name) · **Handle:** `save-for-later-wishlist`
**Purpose:** A Shopify wishlist / "save for later" feature for Century Martial Arts storefronts.
**Status as of this doc:** Small, single-feature app, still mid-build in places (see [Known Issues](#known-issues--gaps)).

---

## 1. What This App Does

### For shoppers (storefront)

- A heart-shaped **"Add to Wishlist" button** appears on product pages via a theme block (`extensions/wishlist-icon/blocks/wishlist-icon.liquid`). Clicking it adds/removes the current product variant from the shopper's wishlist.
- **Login required** — the button only works for logged-in customers. Logged-out visitors see "Please log in to add to wishlist" instead of the button.
- A separate **wishlist listing page** (theme block `extensions/wishlist-icon/blocks/wishlist-list.liquid`) shows everything a customer has saved: product image, title, variant, live price and availability (fetched directly from Shopify's Storefront GraphQL API), plus an "Add to Cart" link.
- **Notes / Has / Needs** — a distinctive feature beyond a typical wishlist. Each saved item can have a free-text note and two numbers: **Has** (how many the customer already owns) and **Needs** (how many they still want). This reads like it's built for gear/uniform tracking (e.g. "I have 2 size-4 gis, I need 1 more") rather than generic gift-list use.
- No guest/anonymous wishlists — there's no cookie- or device-based fallback, so a shopper must be a logged-in customer to use any of this.

### For merchants (Shopify admin)

- There is exactly **one screen** in the embedded admin app: a **"Wishlist Analytics Dashboard"** (`app/routes/app._index.jsx`).
- It shows KPI cards — Total Stores, Total Wishlist Items, Active Customers, Wishlisted Products — and a sortable table breaking those numbers down per store (Store, Total Items, Customers, Products, Avg Items/Customer, Last Activity).
- It's **read-only aggregate reporting**: no settings page, no per-item management, no CSV export, no date-range filtering.
- The dashboard currently reports on **all shops that have installed the app in one shared view**, with a hardcoded display-name map for three Century-related stores: `centuryweb.myshopify.com`, `century-us-wholesale.myshopify.com`, `gameness.myshopify.com`. This strongly suggests the app today is an **internal Century tool**, not something scoped for arbitrary third-party merchants — see [Known Issues](#known-issues--gaps).

### What this app does **not** do (to set expectations correctly)

- No back-in-stock alerts
- No price-drop alerts
- No email or SMS notifications of any kind
- No billing/subscription — the app is free/unmonetized in code today
- No merchant-facing settings UI (customization is theme-editor-only, see §2.5)

---

## 2. Technical Implementation

### 2.1 Stack

| Layer | Technology |
|---|---|
| Framework | Remix v2.16 (JS/JSX, not TypeScript), built with Vite |
| Admin UI | Shopify Polaris v12 + App Bridge React v4 (embedded app) |
| Storefront extension | Shopify **theme app extension** (Liquid blocks), Alpine.js (CDN) for the icon block, vanilla JS for the listing block |
| Auth / platform glue | `@shopify/shopify-app-remix` v3.7, API version `2025-01` |
| Database | PostgreSQL (Render-hosted) |
| ORM | Prisma v6.2 (`@prisma/client`), sessions via `@shopify/shopify-app-session-storage-prisma` |
| Hosting (apparent) | Render.com — see deployment note in §2.6 |

### 2.2 Architecture at a glance

```
Storefront (theme)                         Admin (Shopify embedded app)
┌─────────────────────────┐                ┌──────────────────────────┐
│ wishlist-icon.liquid     │                │ app._index.jsx           │
│ wishlist-list.liquid     │                │ "Wishlist Analytics      │
│ (Alpine.js / vanilla JS) │                │  Dashboard" (Polaris)    │
└───────────┬──────────────┘                └────────────┬─────────────┘
            │ fetch() GET/POST/PUT/DELETE                 │ Shopify OAuth
            ▼                                             ▼
   /api/wishlist  (Remix resource route, public, CORS: *) │
            │                                             │
            └───────────────────┬─────────────────────────┘
                                 ▼
                        Prisma Client → PostgreSQL
                     (Wishlist, Session, Settings tables)
```

The theme blocks also call Shopify's public **Storefront GraphQL API** directly (client-side, unauthenticated) to resolve live price/availability/title for wishlisted variants — that traffic bypasses this app's own API entirely.

### 2.3 Data model (`prisma/schema.prisma`)

```prisma
model Wishlist {
  id          Int       @id @default(autoincrement())
  customerId  String?
  productId   String?
  variantId   String?
  notes       String?
  has         Int?
  needs       Int?
  shop        String?
  createdAt   DateTime  @default(now())
}
```

- **Everything is nullable** — no required fields, no foreign keys, no unique constraints at the DB level. Deduplication (e.g. preventing the same customer from wishlisting the same variant twice) is handled in application code, not the schema.
- A wishlist item is keyed on **variant**, not just product — `variantId` is what add/remove/notes operations actually match on.
- `shop` stores the `.myshopify.com` domain, which is how one shared table supports multiple stores and how the admin dashboard breaks out per-store analytics.
- `customerId` is the Shopify **customer ID** — this is customer PII, which matters for the GDPR gap noted below.
- Two other tables exist: `Session` (standard Shopify OAuth session storage) and `Settings` (`id`, `name`, `description`) — `Settings` is defined but not read or written anywhere in the app; it's an unused stub.
- Only one migration exists: `prisma/migrations/20250101000000_init_postgresql/`.

### 2.4 API (`app/routes/api.wishlist.jsx`)

A single public Remix resource route at `/api/wishlist`, with `Access-Control-Allow-Origin: *` so any storefront can call it directly.

| Method | Behavior |
|---|---|
| `GET` | Returns wishlist rows filtered by `customerId`+`shop` (all items), or `customerId`+`productId`+`shop` (check-if-saved) |
| `POST` | Creates a wishlist row (`customerId`, `productId`, `variantId`, `shop`, `notes`) — note: `has`/`needs` are read from the form but **not saved** on create |
| `PUT` | Updates `notes`/`has`/`needs` via `updateMany({ where: { customerId, variantId } })` — this `where` is **not scoped by `shop`**, so identical customerId+variantId across different shops would all get updated together |
| `DELETE` | Removes a row via `deleteMany` matching `customerId`, `productId`, `variantId`, `shop` |

All writes require `customerId`, `variantId`, `shop` — missing fields return `{ ok: false, message: "Missing required fields" }` with an HTTP 200 (not an error status).

### 2.5 Storefront extension (`extensions/wishlist-icon/`)

A single **theme app extension** (`type = "theme"`) with two blocks:

- **`wishlist-icon.liquid`** — the add/remove heart button. Merchant-configurable via the theme editor: button text, text size, alignment, icon color (defaults to Century red `#cf202f`). Checks wishlist status on load via a `GET` call, then `POST`/`DELETE`s on click.
- **`wishlist-list.liquid`** — the wishlist page grid. No configurable settings; layout, copy, and behavior are hardcoded. Includes the Notes/Has/Needs modal, which `PUT`s back to the API.

Both blocks hardcode the app's URL (`https://wishlist-remix-app.onrender.com`) directly in the Liquid/JS rather than reading it from a theme setting or app proxy.

Also present but not part of the wishlist feature: `snippets/stars.liquid` (a star-rating snippet) and `assets/thumbs-up.png` — both appear to be unused leftovers from a different feature or theme.

### 2.6 Webhooks & deployment

- **Webhooks registered** (`shopify.app.toml`): `app/uninstalled` (deletes the shop's `Session` rows only — wishlist data is untouched) and `app/scopes_update` (updates stored scope).
- **No GDPR mandatory webhooks** (`customers/data_request`, `customers/redact`, `shop/redact`) are registered — see [Known Issues](#known-issues--gaps).
- **Deployment is ambiguous in the repo.** `shopify.app.toml`'s `application_url` and `.env`'s `DATABASE_URL` both point at Render.com + Postgres, and the `Dockerfile` + `docker-start` script (`prisma migrate deploy` → `remix-serve`) support that path directly. But the repo also still contains a Fly.io GitHub Actions deploy workflow (`.github/workflows/fly-deploy.yml`) and SQLite/Litestream tooling (`litestream.yml`, `dbsetup.js`, `prisma/dev.sqlite`, the `@flydotio/litestream` dependency) with no `fly.toml` present. **This looks like leftover infrastructure from an earlier architecture that predates the move to Postgres/Render** — worth confirming with whoever manages the live deploy before treating either path as current.

---

## 3. Known Issues / Gaps

Flagging these because they're the kind of thing that matters before doing more work on this app or exposing it more broadly:

1. **No guest/anonymous wishlists.** The feature is entirely gated behind customer login — no cookie or localStorage fallback for anonymous shoppers.
2. **Hardcoded app URL** baked into the Liquid/JS in the theme extension (not driven by a setting or app proxy) — any hosting change means editing and redeploying the extension.
3. **No GDPR mandatory webhooks.** `customers/data_request`, `customers/redact`, and `shop/redact` are all absent, despite the `Wishlist` table storing customer PII (`customerId`). Worth raising with legal/compliance before wider release.
4. **Wishlist data isn't purged on app uninstall** — only `Session` rows are deleted; a shop's wishlist rows persist indefinitely after uninstall.
5. **No per-shop access scoping on the admin dashboard** — it queries and displays every shop's data in one aggregate view. That's consistent with this being an internal Century-only tool today, but `shopify.app.toml` currently declares `AppDistribution.AppStore`, which implies public distribution. These two things don't match.
6. **Permissive CORS** (`Access-Control-Allow-Origin: *`) on the public `/api/wishlist` route.
7. **Mixed/stale deployment artifacts** — Fly.io + Litestream/SQLite tooling coexists with an apparently-current Render/Postgres setup (see §2.6). Needs confirmation, not something to build on as-is.
8. **No billing implementation** in code — the app is currently free/unmonetized regardless of what's configured in Partners.
9. **Unfinished scaffolding still in the repo:** the `Settings` Prisma model (unused), `app/routes/wishlist-page.jsx` (an early, unstyled scaffold that duplicates what `wishlist-list.liquid` already does properly), the public marketing route (`app/routes/_index/route.jsx`, still template placeholder copy), and the unused `stars.liquid`/`thumbs-up.png` assets.
10. **Minor inconsistencies:** the `Dockerfile`'s Node 23 base image falls outside the `engines` range declared in `package.json`; the webhooks API version (`2025-04` in `shopify.app.toml`) doesn't match the server's API version (`2025-01` in `app/shopify.server.js`).

---

## 4. Quick File Map

| Concern | File(s) |
|---|---|
| Admin dashboard | `app/routes/app._index.jsx` |
| Admin app shell/nav | `app/routes/app.jsx` |
| Wishlist API | `app/routes/api.wishlist.jsx` |
| Unfinished customer-page scaffold | `app/routes/wishlist-page.jsx` |
| Uninstall/scope webhooks | `app/routes/webhooks.app.uninstalled.jsx`, `app/routes/webhooks.app.scopes_update.jsx` |
| Shopify auth/app setup | `app/shopify.server.js` |
| Prisma client | `app/db.server.js` |
| Data model | `prisma/schema.prisma`, `prisma/migrations/20250101000000_init_postgresql/` |
| Theme extension | `extensions/wishlist-icon/blocks/wishlist-icon.liquid`, `extensions/wishlist-icon/blocks/wishlist-list.liquid` |
| App config | `shopify.app.toml`, `shopify.web.toml` |
| Build/dev config | `vite.config.js` (active), `remix.config.js` (legacy, likely unused) |
| Deployment | `Dockerfile`, `.github/workflows/fly-deploy.yml`, `litestream.yml`, `dbsetup.js` |
