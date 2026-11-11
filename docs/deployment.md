# Deployment

How this app reaches production: the **Render-hosted Remix backend**, and the **Shopify app version** (config + theme extension). Both matter. For the human workflow, see [getting-started.md](getting-started.md).

## What "production" means here

| Piece | Source of truth | How it ships |
|---|---|---|
| Remix server | `Dockerfile`, `npm run docker-start`, `npm run start` | Render Docker web service; **auto-deploys on every commit to `main`** |
| Database | `prisma/schema.prisma` (PostgreSQL) | Render-managed Postgres 17; `prisma migrate deploy` runs via `docker-start` → `setup` on each deploy |
| App config (URL, scopes, webhooks) | `shopify.app.toml` | `npm run deploy` (`shopify app deploy`) — **not** automatic with git merge |
| Theme extension | `extensions/wishlist-icon/` | Same `shopify app deploy` |

`shopify.app.toml` on `main` sets `application_url` and auth callback URLs to the production app URL. Treat that file as the declared production app URL (this public repo's docs do not repeat hostnames).

## Backend: Render

Confirmed hosting:

- **Platform:** Render, workspace **Century** (a team — new developers need an invite to that workspace).
- **Service:** Docker web service built from `./Dockerfile` at the repo root (starter plan, Oregon region, 1 instance). Refer to it as the wishlist service in the Century Render workspace.
- **Database:** Render-managed **PostgreSQL 17**. Production `DATABASE_URL` is that database's connection string, set on the service's **Environment** tab.
- **Container entry:** `Dockerfile` uses `node:23.10.0-alpine` and `CMD ["npm", "run", "docker-start"]`. That runs `prisma generate && prisma migrate deploy`, then `remix-serve`.
- **Auto-deploy:** **ON**, for every commit to **`main`**. Merging a PR to `main` deploys the backend automatically. Nobody runs a manual backend deploy for routine releases.
- **Env vars:** edited in the Render dashboard on the service's **Environment** tab (names only below — get values from the owner).

### Environment variables on the service

| Name | Role |
|---|---|
| `DATABASE_URL` | Production Postgres connection string from the Render-managed database |
| `SHOPIFY_API_KEY` | From Partners app credentials |
| `SHOPIFY_API_SECRET` | From Partners app credentials |
| `SHOPIFY_APP_URL` | Must match the public app URL merchants hit |
| `SCOPES` | Align with `shopify.app.toml` |
| `NODE_ENV` | `production` |

Optional: `SHOP_CUSTOM_DOMAIN` per `shopify.server.js`.

### Backend rollback

In the Render dashboard: open the wishlist service → **Events** / **Deploys** → roll back to a previous deploy. Alternatively, revert the commit on `main` (that triggers another auto-deploy).

### Known issue: GitHub repository link

The Render service is still linked to the **old** GitHub repo URL under `UribeJr` from before the move to **Century-Martial-Arts**. The owner must re-link the service to `Century-Martial-Arts/wishlist-remix-app` (Render dashboard → service **Settings** → **Repository**) and ensure Render's GitHub app has access to the Century-Martial-Arts org. Until that is done, **auto-deploy may stop** after the old remote stops receiving pushes.

### Leftover Fly / Litestream files (cleanup only)

These are **not** the production path. Safe to ignore for shipping; remove only with an agreed cleanup PR:

- `.github/workflows/fly-deploy.yml`
- `litestream.yml`, `dbsetup.js`
- `@flydotio/litestream` and package.json `dockerfile.litestream`
- No `fly.toml` exists

## Shopify app deploy (extensions + config)

Merging to `main` does **not** release Shopify config or the theme extension. From a clean `main` (or the release commit) with the correct toml linked:

```sh
git checkout main
git pull origin main
npm run deploy
```

Review the CLI summary before confirming. This publishes a new **app version** in the Partners Dashboard (config + `wishlist-icon` extension).

After deploy:

1. Partners → Apps → this app → **Versions** — confirm the new version is released.
2. Verify theme embeds/blocks on the live theme.
3. If you changed the hardcoded extension app URL, confirm storefront network calls hit the production backend.

### Rolling back an app version

Partners Dashboard → app → **Versions** → release a previous version. Backend rollbacks are separate (Render deploy rollback above).

## Scope and webhook changes

- Editing `[access_scopes]` requires `shopify app deploy` and merchant re-approval on each shop.
- Webhook subscriptions in the toml update on deploy (app-specific webhooks).
- Changing only Remix route code without toml/extension changes ships with the **Render auto-deploy** on merge to `main`; it does not need a new extension version.

## Database migrations

1. Add a migration under `prisma/migrations/` when the schema changes.
2. Test `npm run setup` against a non-production database.
3. Backup production before migrate (Render Postgres; ask the owner for the backup/restore path they use).
4. Merge to `main`. The new deploy runs `docker-start` → `prisma migrate deploy` automatically. Coordinate consciously — a bad migration can take production down on deploy.

## Open questions

Hosting and env-var location are confirmed above. Still open:

1. Theme publish process after extension versions release (who publishes / syncs the live theme).
2. Purpose of the remote `production` git branch (it appears behind `main` as an old snapshot).
3. When the Render ↔ GitHub re-link to Century-Martial-Arts will be completed.
