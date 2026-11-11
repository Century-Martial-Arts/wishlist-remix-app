# Deployment

How this app reaches production: the **hosted Remix backend**, and the **Shopify app version** (config + theme extension). Both matter. For the human workflow, see [getting-started.md](getting-started.md).

## What "production" means here

| Piece | Source of truth in repo | How it ships |
|---|---|---|
| Remix server | `Dockerfile`, `npm run docker-start`, `npm run start` | Deploy container/build to the production host |
| Database | `prisma/schema.prisma` (PostgreSQL) | `prisma migrate deploy` (also invoked by `docker-start` → `setup`) |
| App config (URL, scopes, webhooks) | `shopify.app.toml` | `npm run deploy` (`shopify app deploy`) |
| Theme extension | `extensions/wishlist-icon/` | Same `shopify app deploy` |

`shopify.app.toml` on `main` sets `application_url` and auth callback URLs to the production host. Treat that file as the declared production app URL.

## Backend host (current evidence)

**Looks current**

- `Dockerfile` (`node:23.10.0-alpine`) builds the app and runs `npm run docker-start`
- `docker-start` = `prisma generate && prisma migrate deploy` then `remix-serve`
- Prisma provider is `postgresql`
- `application_url` in `shopify.app.toml` points at a hosted web service (not a Cloudflare trycloudflare tunnel on `main`)

**Looks leftover**

- `.github/workflows/fly-deploy.yml` (Fly deploy on push to `main`)
- `litestream.yml`, `dbsetup.js`, `@flydotio/litestream`, package.json `dockerfile.litestream`
- No `fly.toml` in the repo
- Schema is no longer SQLite

**Do not assume.** Confirm with the owner which host is live, how deploys are triggered, and whether the Fly Action is disabled or still somehow wired. Until confirmed, prefer the owner's runbook over inventing a new pipeline.

### Environment variables on the host

Set at least (names only — get values from the owner):

| Name | Role |
|---|---|
| `DATABASE_URL` | Production Postgres |
| `SHOPIFY_API_KEY` | From Partners app credentials |
| `SHOPIFY_API_SECRET` | From Partners app credentials |
| `SHOPIFY_APP_URL` | Must match the public app URL merchants hit |
| `SCOPES` | Align with `shopify.app.toml` |
| `NODE_ENV` | `production` |

Optional: `SHOP_CUSTOM_DOMAIN` per `shopify.server.js`.

## Shopify app deploy (extensions + config)

```sh
git checkout main
git pull origin main
npm run deploy
```

Review the CLI summary before confirming. This publishes a new **app version** in the Partners Dashboard (config + `wishlist-icon` extension).

After deploy:

1. Partners → Apps → this app → **Versions** — confirm the new version is released.
2. Verify theme embeds/blocks on the live theme.
3. If you changed the hardcoded extension app URL, confirm storefront network calls hit the new host.

### Rolling back an app version

Partners Dashboard → app → **Versions** → release a previous version. Backend host rollbacks are separate (redeploy previous image/release).

## Scope and webhook changes

- Editing `[access_scopes]` requires `shopify app deploy` and merchant re-approval on each shop.
- Webhook subscriptions in the toml update on deploy (app-specific webhooks).
- Changing only Remix route code without toml/extension changes still needs a **backend** deploy; it does not need a new extension version.

## Database migrations

1. Add a migration under `prisma/migrations/` when the schema changes.
2. Test `npm run setup` against a non-production database.
3. Backup production before migrate.
4. Ship the migration with the backend release. If production uses `docker-start`, migrate runs on container start — still coordinate consciously.

## CI note

The only workflow in `.github/workflows/` is `fly-deploy.yml`. There is no documented GitHub Actions pipeline for Render (or similar) in this repo. Ask the owner how production builds are actually triggered today.

## Open questions

1. Exact production host dashboard and who can deploy.
2. Whether GitHub Actions Fly deploy is active, disabled, or obsolete.
3. Where production secrets live.
4. Theme publish process after extension versions release.
5. Purpose of the remote `production` git branch (it appears behind `main` as an old snapshot).
