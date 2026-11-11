# Wishlist API

Public Remix resource route: `app/routes/api.wishlist.jsx` → **`/api/wishlist`**.

Consumed by the theme extension. Not authenticated with session tokens; callers pass Shopify customer/shop identifiers in query string or form body. CORS headers allow any origin.

Related: [extensions.md](extensions.md) · [architecture.md](architecture.md)

## CORS

Every JSON response (and `OPTIONS`) includes:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## GET — list or check

Query parameters:

| Param | Required | Use |
|---|---|---|
| `customerId` | yes (for a useful result) | Shopify customer id |
| `shop` | yes (for a useful result) | Shop permanent domain |
| `productId` | optional | If present with the two above, filters to that product |

Behavior:

- `customerId` + `productId` + `shop` → `findMany` for that product (used by product-page "already saved?" check)
- `customerId` + `shop` → all rows for that customer in that shop (listing + grid state)
- otherwise → empty `data` array

Response shape:

```json
{ "ok": true, "data": [ /* Wishlist rows */ ] }
```

## POST — add

`multipart/form-data` (or urlencoded FormData from the browser).

| Field | Required | Saved? |
|---|---|---|
| `customerId` | yes | yes |
| `variantId` | yes | yes |
| `shop` | yes | yes |
| `productId` | no for validation, yes in practice from theme | yes if sent |
| `notes` | no | yes (default `""`) |
| `has` / `needs` | parsed but **not** written on create | no |

Missing `customerId`, `variantId`, or `shop` → `{ ok: false, message: "Missing required fields" }` with **HTTP 200**.

Success → message `"Item added to wishlist"` and the created row. No uniqueness check: duplicate posts can create duplicate rows.

## PUT — update notes / has / needs

| Field | Required | Notes |
|---|---|---|
| `customerId` | yes | |
| `variantId` | yes | |
| `shop` | required by the shared validation, **not** used in `where` | see gotcha below |
| `notes`, `has`, `needs` | optional | `has`/`needs` parsed with `parseInt`, default `0` |

`updateMany({ where: { customerId, variantId } })` — **not scoped by `shop`**. Identical customer and variant ids across shops would all update.

## DELETE — remove

Matches `customerId`, `productId`, `variantId`, `shop` via `deleteMany`. Theme callers should keep sending `productId` so the delete filter matches.

## Other methods

- `OPTIONS` → empty 200 with CORS headers
- anything else in the action switch → `{ ok: false, message: "Method not allowed" }` with HTTP 405

## Gotchas

1. **Do not trust HTTP status alone** for write validation failures — missing fields return 200.
2. **POST drops `has`/`needs`** even though the action parses them. Listing users set those via PUT afterward.
3. **PUT is not shop-scoped** in the `where` clause.
4. **No auth beyond knowing ids** — treat the route as a public write surface; tightening it needs a coordinated theme change.
5. **Admin dashboard** reads the same `Wishlist` table but never through this route (`app._index.jsx` uses Prisma directly after `authenticate.admin`).
