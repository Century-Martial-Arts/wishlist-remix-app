# Wishlist app — overview

**Canonical docs:** [README.md](README.md) · [docs/getting-started.md](docs/getting-started.md) · [docs/architecture.md](docs/architecture.md) · [docs/setup.md](docs/setup.md)

This file is a short orientation stub. Detailed behavior, API gotchas, extension hooks, and deploy notes live under `docs/`.

## What it is

Shopify wishlist / "save for later" for Century Martial Arts storefronts.

- Config name **WishlistFu**, handle `save-for-later-wishlist` (`shopify.app.toml`)
- Shoppers (logged in) heart variants from product pages, grids, and the cart page; listing page supports Notes / Has / Needs
- Merchants get one embedded **Wishlist Analytics Dashboard**
- Stack: Remix + Polaris admin, theme app extension storefront, Postgres via Prisma

## Where the real logic lives

| Concern | Path |
|---|---|
| Admin dashboard | `app/routes/app._index.jsx` |
| Wishlist API | `app/routes/api.wishlist.jsx` |
| Theme extension | `extensions/wishlist-icon/` |
| Auth / sessions | `app/shopify.server.js`, `app/db.server.js` |
| Schema | `prisma/schema.prisma` |

## Status notes

Still a focused single-feature app with known gaps (no guest wishlist, hardcoded extension app URL, no GDPR mandatory webhooks in-repo, admin dashboard aggregates all shops, leftover Fly/Litestream files). Backend hosting is Render (Century workspace) + managed Postgres 17; see [docs/deployment.md](docs/deployment.md). Broader gaps: [docs/architecture.md#limitations-and-known-gaps](docs/architecture.md#limitations-and-known-gaps).

Store domains, production hostnames, service IDs, dashboard links, and credentials are intentionally omitted here — this repository is public. Get those from the owner / Render workspace when you need them.
