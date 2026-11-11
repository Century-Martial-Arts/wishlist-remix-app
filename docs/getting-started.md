# Getting Started

This guide is for a Century developer who needs to work on **Save for Later (WishlistFu)** and ship changes to the live app. It uses numbered steps, copy-paste commands, and what you should see after each step.

**Shopify terms used here**

- **Partners Dashboard** — Shopify Partners site where the organization owns apps, team members, and development stores ([partners.shopify.com](https://partners.shopify.com)).
- **Development store (dev store)** — a free Shopify store used only for building and testing apps. Never use the live merchant store for day-to-day coding.
- **App version** — a snapshot of app config + extensions released with `shopify app deploy`. Partners keeps previous versions so you can roll back.
- **Theme app extension** — storefront UI (Liquid/JS blocks) shipped with the app and enabled in the theme editor. This app's extension is `extensions/wishlist-icon`.

Related docs: [setup.md](setup.md) · [architecture.md](architecture.md) · [deployment.md](deployment.md)

---

## Your first day checklist

Work top to bottom. Check each box when done.

1. [ ] Invited to the **Century-Martial-Arts** GitHub org with access to `wishlist-remix-app`
2. [ ] Added to the Shopify **Partners** organization (Partners Dashboard → **Team**) with permission for this app
3. [ ] Access to a **development store** and (when you need to verify production) the **live store** Admin
4. [ ] Invited to the **Century** Render workspace (needed to see the wishlist service, logs, env vars, and deploys)
5. [ ] Env var values from the owner for local work (names only in this repo: see [`.env.example`](../.env.example)); production values live on the Render service **Environment** tab
6. [ ] Node, npm, Git, and Shopify CLI installed
7. [ ] Repo cloned, deps installed, `.env` filled, Prisma set up
8. [ ] CLI linked to the **existing** Partners app (not a new app)
9. [ ] `npm run dev` running against the **dev store**; theme blocks enabled; logged-in wishlist test works
10. [ ] Read [Safety checklist](#safety-checklist) before any production deploy

---

## 1. Access you need first

Ask the owner (or your lead) for each of these before spending time on tooling:

| Access | Why you need it | Who grants it |
|---|---|---|
| GitHub org + this repo | Clone, branch, open PRs | Century-Martial-Arts GitHub admin |
| Shopify Partners team seat | See the app, run CLI link/dev/deploy | Partners Dashboard → **Team** |
| App permissions for **WishlistFu** (`handle`: `save-for-later-wishlist`) | Install on stores, deploy versions | Partners admin |
| Development store | Local `shopify app dev` and theme testing | Partners / store owner |
| Live store Admin (when verifying releases) | Confirm hearts and listing on production | Store owner |
| Century Render workspace | See the wishlist Docker web service, deploys, logs, and Environment tab | Render workspace admin / owner |
| Env values for local `.env` | `DATABASE_URL` (use a non-production DB unless the owner says otherwise) and any Shopify values not injected by the CLI | Owner (never commit them) |

**App identity (from `shopify.app.toml` on `main`):**

- Config **name:** `WishlistFu`
- **Handle:** `save-for-later-wishlist`
- **client_id:** `12ad595b7060f8c4f69a26b37d661faf`
- **Embedded:** yes
- **Scopes:** `read_products,unauthenticated_read_product_listings,write_products`
- **application_url / auth redirect URLs:** see `shopify.app.toml` (production host URL — do not invent a new one)

**If this fails:** you cannot finish CLI link or deploy without Partners access. Stop and get the invite rather than creating a personal app.

---

## 2. Install tooling

### Node.js

`package.json` engines: `^18.20 || ^20.10 || >=21.0.0`. There is **no** `.nvmrc` in this repo.

```sh
node -v
npm -v
```

**Expected:** a Node version in that range (for example `v20.x` or `v22.x`) and an npm version printed.

**If this fails:** install Node from [nodejs.org](https://nodejs.org/) or your version manager (`nvm`, `fnm`, etc.). The production `Dockerfile` uses `node:23.10.0-alpine`, which is outside the lower end of `engines` but valid for `>=21`. Prefer Node 20 LTS or 22 for local work unless the owner says otherwise.

### Git

```sh
git --version
```

### Shopify CLI

```sh
npm install -g @shopify/cli @shopify/theme
shopify version
```

**Expected:** CLI version output (3.x or 4.x is fine for this workflow).

**If this fails:** use `npx shopify version` instead of a global install, or follow [Shopify CLI docs](https://shopify.dev/docs/api/shopify-cli).

---

## 3. Clone, install, env, database

```sh
git clone https://github.com/Century-Martial-Arts/wishlist-remix-app.git
cd wishlist-remix-app
npm install
cp .env.example .env
```

Edit `.env`. Minimum for local work once the CLI is linked:

| Name | What to put |
|---|---|
| `DATABASE_URL` | Postgres URL from the owner (local or shared dev DB — **not** production unless they explicitly say so) |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_APP_URL` / `SCOPES` | Often injected by `shopify app dev`; still useful to have for non-CLI runs |

```sh
npm run setup
```

**Expected:** `prisma generate` and `prisma migrate deploy` succeed. Schema provider is **PostgreSQL** (`prisma/schema.prisma`).

**If this fails:**

- `P1001` / can't reach database → wrong host, VPN, or firewall; confirm `DATABASE_URL` with the owner.
- Migration errors → you may be pointed at a DB that isn't empty or isn't Postgres. Do not run experimental migrations against production.

There is only one migration folder today: `prisma/migrations/20250101000000_init_postgresql/`.

---

## 4. Link the CLI to the existing Partners app

This repo already belongs to a real Partners app. **Do not create a new app.**

```sh
npm run config:link
```

That runs `shopify app config link`. When prompted:

1. Log into the **Century** Partners organization (not a personal Partners account).
2. Choose the existing app that matches **WishlistFu** / handle `save-for-later-wishlist` / client_id `12ad595b7060f8c4f69a26b37d661faf`.
3. Keep using `shopify.app.toml` as the active config unless the owner gives you a separate production toml.

**Check after linking:**

```sh
head -n 20 shopify.app.toml
```

**Expected:** `name = "WishlistFu"`, `handle = "save-for-later-wishlist"`, same `client_id` as above, and the production `application_url` already present on `main`.

**Dev vs production toml:** this repo currently has a single `shopify.app.toml` (no `shopify.app.production.toml` / `shopify.app.dev.toml` in tree). Use `npm run config:use` only if the owner adds multiple config files later.

**If this fails:** wrong Partners org, or you created a new app by mistake. Delete any accidental personal app config and re-link to the Century app. Ask the owner before changing `client_id` or `application_url`.

---

## 5. Run locally against a development store

```sh
npm run dev
```

**Expected:** Shopify CLI starts a tunnel, prints a preview URL, and offers to open the app (`p` in the terminal). Choose your **development store** when asked. Install/approve the app on that store if prompted.

### Enable the theme extension

1. In the **dev store** Admin, open the theme editor for the theme you use for testing.
2. Enable the app embeds / blocks from the **wishlist-icon** theme extension:
   - **Wishlist icon** — product page heart
   - **Wishlist Listing** — wishlist page section
   - **Wishlist hearts** — app embed for grid/cart hearts and header link
3. For the embed, set **Wishlist page** to a storefront page that contains the listing block.
4. Save the theme.

### Preview and test

1. Open the storefront as a **logged-in customer** (guests cannot save).
2. On a product page, click the wishlist heart — it should fill and stay filled after refresh.
3. On a collection grid (with theme hooks present), click a heart — same behavior; guests should be sent to login.
4. Open the wishlist page — items appear with price/availability; Notes / Has / Needs can be edited.
5. In Admin → Apps → this app, open the **Wishlist Analytics Dashboard** and confirm counts move after you save items.

**If this fails:** see [setup troubleshooting](setup.md#troubleshooting). Common causes: extension not enabled, not logged in as a customer, `DATABASE_URL` pointing at an empty or unreachable DB, or the hardcoded extension app URL still pointing at production while you expected local API traffic (see [extensions.md](extensions.md#hardcoded-app-url)).

---

## 6. Git workflow

```sh
git checkout main
git pull origin main
git checkout -b your-initials/short-description
```

Branch naming is not enforced by tooling in this repo. Prefer short, lowercase, descriptive names. Cloud agent branches use `cursor/...` — human PRs can use `your-initials/topic`.

```sh
git status
git add <files you changed>
git commit -m "Describe the why in one short sentence"
git push -u origin HEAD
```

Then open a pull request against **`main`** on GitHub. Wait for review before merge.

**Expected:** PR shows only your intended files. Do not commit `.env`, `node_modules`, or build output.

**If this fails:** if `main` moved, rebase or merge `main` into your branch before asking for review.

---

## 7. Releasing to the live app

Shipping has **two parts**. Skipping either leaves production half-updated. Details: [deployment.md](deployment.md).

### A. Deploy the web/backend (Remix server + database)

The backend is a **Render Docker web service** in the **Century** Render workspace (starter plan, built from `./Dockerfile`). Production data is a **Render-managed PostgreSQL 17** database; `DATABASE_URL` on the service **Environment** tab is that database's connection string.

1. Merge your PR to **`main`**. Render **auto-deploys** on every commit to `main` — you do **not** run a manual backend deploy for routine releases.
2. In the Century Render workspace, open the wishlist service → watch the new deploy until it is live. The container runs `npm run docker-start` (`prisma migrate deploy`, then `remix-serve`).
3. Production env vars (`DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `NODE_ENV=production`, …) are edited only on the service **Environment** tab — never commit them.
4. Treat schema migrations as sensitive: they run automatically on deploy via `docker-start`. Test migrations against a non-production database first.

**Expected after merge:** a new deploy appears on the wishlist service; when it succeeds, the live app serves your backend changes.

**If this fails:** check the deploy logs on the wishlist service. Also read the [known GitHub re-link issue](deployment.md#known-issue-github-repository-link) — the service may still point at the old `UribeJr` repo URL, which can stop auto-deploy.

### B. Release app config + theme extension (Partners)

Merging to `main` does **not** release Shopify config or the theme extension. From a clean `main` with the correct toml linked:

```sh
npm run deploy
```

That runs `shopify app deploy`. Confirm the summary (extension `wishlist-icon`, scopes, webhooks, app URL).

**Expected:** Partners Dashboard → Apps → this app → **Versions** shows a new version. The theme extension update becomes available to the live theme (you may still need to publish/sync theme app embeds depending on how the live theme is managed).

### Verify on the live store

1. Hard-refresh a product page and collection page as a logged-in customer.
2. Toggle a heart; confirm the wishlist page and admin dashboard.
3. If you changed extension JS/CSS, confirm grid/cart hearts and header link at desktop width (≥768px header hearts are shown by the extension CSS).

### Roll back

1. **App / extension:** Partners Dashboard → app → **Versions** → release a previous version.
2. **Backend:** in the Render dashboard, open the wishlist service → **Events** / **Deploys** → roll back to a previous deploy (or revert the commit on `main`, which triggers another auto-deploy).
3. **Database:** only roll back migrations with an explicit plan from the owner — there is no automated down-migration workflow documented here.

**If this fails:** check Render deploy logs, Partners version errors, and whether the extension still hardcodes the old app URL. Scope changes need the merchant to re-approve the app.

---

## 8. Safety checklist

- [ ] Never point local `shopify app dev` at the **live** store for routine work — use a **dev store**.
- [ ] Never commit secrets or real `.env` values; production secrets stay on the Render **Environment** tab.
- [ ] Merging to `main` auto-deploys the backend — review carefully before merge.
- [ ] Scope changes in `shopify.app.toml` require merchant re-approval after `shopify app deploy`.
- [ ] Webhook and app URL changes ship with `shopify app deploy`, not only a Render redeploy.
- [ ] Theme extension URL is hardcoded — hosting moves need an extension edit + deploy.
- [ ] Be careful with Prisma migrations on production Postgres 17; they run on deploy via `docker-start`.
- [ ] Admin dashboard sees **all shops'** wishlist data — treat production Admin access as sensitive.
- [ ] Do not "clean up" leftover Fly/Litestream files or GDPR gaps casually without an agreed plan.

---

## Making your first change

A small, safe practice change: update the default product-page button label in the theme editor schema (does not require DB changes).

### 1. Edit locally

Open `extensions/wishlist-icon/blocks/wishlist-icon.liquid`. In the `{% schema %}` JSON, find the `text` setting `default` (`"Add to wishlist"`) and change it to something obvious for testing, for example `"Save for later"`.

### 2. Run locally

```sh
npm run dev
```

In the **dev store** theme editor, re-add or reset the Wishlist icon block if it still shows the old default, save, then view a product page as a logged-in customer.

**Expected:** new default text on fresh block instances; heart still toggles wishlist state.

### 3. PR

```sh
git checkout -b your-initials/wishlist-icon-default-text
git add extensions/wishlist-icon/blocks/wishlist-icon.liquid
git commit -m "Clarify default wishlist button label"
git push -u origin HEAD
```

Open a PR against `main`, request review, merge.

### 4. Deploy

1. Merge to `main` if you also changed server code (this Liquid-only change does **not** need a backend change, but merging still auto-deploys whatever is on `main`).
2. Run `npm run deploy` to release the **extension** version (required for this Liquid change).
3. Verify on the live theme (you may need to refresh the block / theme publish process used by Century).

### 5. Roll back if needed

Release the previous app version in Partners. For backend rollbacks, use the wishlist service **Events** / **Deploys** in the Century Render workspace (or revert on `main`). Revert the git commit on a follow-up PR if the copy change should stay out of `main`.

---

## Open questions

Hosting, auto-deploy, and where production env vars live are confirmed in [deployment.md](deployment.md). Still open for the owner:

1. **How the live theme is updated** after `shopify app deploy` (auto app embeds vs manual theme publish).
2. **Whether `origin/production` is used for anything** — it currently looks like an old snapshot, not ahead of `main`.
3. **Who is on the Partners team** and what role a new developer should receive.
4. **Whether App Store distribution (`AppDistribution.AppStore` in code) is intentional** given the internal multi-store dashboard.
5. **When the Render service will be re-linked** from the old `UribeJr` GitHub repo to `Century-Martial-Arts/wishlist-remix-app` (see [deployment known issue](deployment.md#known-issue-github-repository-link)).
6. **Local/dev database** — which Postgres instance (if any) juniors should use instead of production, and the backup policy before production migrations.
