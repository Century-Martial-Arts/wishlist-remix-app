# Setup and local testing

This guide takes you from a fresh clone to a working wishlist on a Shopify **development store**. For first-day access, production shipping, and safety rules, use [getting-started.md](getting-started.md).

**Contents:** [Prerequisites](#prerequisites) · [Steps 1–8](#1-install) · [Theme setup](#theme-setup-on-the-dev-store) · [Test checklist](#test-checklist) · [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js `^18.20 || ^20.10 || >=21.0.0` (from `package.json` engines; no `.nvmrc`)
- npm (lockfile is `package-lock.json`)
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (used via `npm run dev` / `npm run deploy`)
- Git
- A Shopify Partner account on the **Century** organization, with access to this app
- A Shopify **development store** (not the live store)
- A Postgres database URL for local or shared-dev use (`DATABASE_URL`)

## 1. Install

```sh
git clone https://github.com/Century-Martial-Arts/wishlist-remix-app.git
cd wishlist-remix-app
npm install
```

**Expected:** dependencies install; workspaces include `extensions/*`.

## 2. Link to the existing Partners app

`shopify.app.toml` already points at Century's app (`name = "WishlistFu"`, `handle = "save-for-later-wishlist"`). Link the CLI to that app:

```sh
npm run config:link
```

Choose the **existing** app. Do not create a new one.

Confirm `shopify.app.toml` still has:

- `scopes = "read_products,unauthenticated_read_product_listings,write_products"`
- Webhooks for `app/uninstalled` and `app/scopes_update`
- The production `application_url` and matching `[auth] redirect_urls`

There is only one toml in the repo today. If you need to switch configs later: `npm run config:use`.

## 3. Environment variables

```sh
cp .env.example .env
```

Fill in `.env` (never commit it):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL for Prisma |
| `SHOPIFY_API_KEY` | App key — often injected by `shopify app dev` |
| `SHOPIFY_API_SECRET` | App secret — often injected by `shopify app dev` |
| `SHOPIFY_APP_URL` | Public app URL (CLI tunnel while developing) |
| `SCOPES` | Should match toml scopes |
| `SHOP_CUSTOM_DOMAIN` | Optional; only if a shop uses a custom domain helper in `shopify.server.js` |

## 4. Database

```sh
npm run setup
```

Runs `prisma generate && prisma migrate deploy` against Postgres. The schema lives in `prisma/schema.prisma`; the migration is `prisma/migrations/20250101000000_init_postgresql/`.

**Note:** `shopify.web.toml` also runs `prisma generate` on predev and `prisma migrate deploy` before Vite in `shopify app dev`.

## 5. Store settings for testing

- Use a **development store** only.
- Create or use a **customer account** you can log into on the storefront — wishlist writes require login.
- Theme password (if the storefront is password-protected): Online Store → Preferences.

## 6. Run the app

```sh
npm run dev
```

Choose the development store, press `p` to open the app, and approve install if asked. Scopes requested should match the toml.

## 7. Point expectations about the API URL

The theme extension currently **hardcodes** the production app URL in Liquid/JS (see [extensions.md](extensions.md#hardcoded-app-url)). That means:

- Admin routes and webhooks go through the CLI tunnel as usual during `shopify app dev`.
- Storefront hearts may still call the **hosted** `/api/wishlist` unless you temporarily change those hardcoded URLs for local API debugging.

For most theme UI work, `shopify app dev` still rebuilds the extension for preview. For API-only local debugging, either change the hardcoded URL to your tunnel (do not commit) or test against a shared remote API intentionally.

## 8. Useful scripts

| Script | What it runs |
|---|---|
| `npm run dev` | `shopify app dev` |
| `npm run build` | `remix vite:build` |
| `npm run setup` | Prisma generate + migrate deploy |
| `npm run lint` | ESLint |
| `npm run deploy` | `shopify app deploy` |
| `npm run start` | `remix-serve ./build/server/index.js` |
| `npm run docker-start` | `setup` then `start` (container entry) |

There is **no** `npm test` suite in this repository.

## Theme setup on the dev store

1. Open the theme editor on the development store.
2. Add **Wishlist icon** to a product template/section.
3. Create a page for the wishlist, add **Wishlist Listing**, and note the page URL.
4. Enable the **Wishlist hearts** app embed (`wishlist-grid-embed`): set heart color and select the wishlist page.
5. Ensure the theme exposes the data attributes the shared controller expects (product cards, cart page line items, header hooks). Century's storefront themes already integrate these for the shared controls; a stock Dawn theme will need the same hooks before grid/cart hearts appear. See [extensions.md](extensions.md).

## Test checklist

Run these as a **logged-in customer** on the development store:

1. Product page heart adds and removes the current variant; refresh keeps state.
2. Guest on product page sees the login prompt (no write).
3. Collection/grid heart toggles when theme hooks are present; guest click goes to login.
4. Cart **page** heart toggles without removing the line item; cart drawer is unchanged by design.
5. Wishlist listing shows image, title, variant, price, availability; Add to Cart works.
6. Notes / Has / Needs modal saves and reloads values.
7. Admin → app home shows updated analytics totals for the shop.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `The table … does not exist` | Run `npm run setup`; confirm `DATABASE_URL` is Postgres |
| OAuth / install loop after scope edit | Deploy config so Partners has the new scopes (`npm run deploy`), then reinstall on the dev store |
| Hearts do nothing / network errors | Hardcoded app URL unreachable; CORS preflight failing; or missing `customerId` / `shop` |
| Guest cannot save | Expected — login required |
| Grid/cart hearts missing | App embed off, or theme missing `data-wishlist-*` hooks |
| Listing shows IDs but no price | Storefront GraphQL call failed (listing talks to `https://{shop}/api/2025-07/graphql.json` directly) |
| Admin dashboard empty | No rows for that shop yet, or `DATABASE_URL` points at a different database than the storefront API uses |
| Lint noise / build fails in Docker | Reproduce with `npm run build`; Node 23 is what the Dockerfile uses |

For architecture-level gaps (GDPR webhooks, uninstall data retention, multi-shop admin), see [architecture.md](architecture.md#limitations-and-known-gaps).
