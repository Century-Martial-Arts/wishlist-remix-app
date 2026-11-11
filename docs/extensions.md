# Theme extension

The shopper UI is the theme app extension at `extensions/wishlist-icon/` (`type = "theme"`, name `wishlist-icon` in `shopify.extension.toml`).

Related: [api.md](api.md) · [setup.md](setup.md)

## Blocks

| Block file | Theme editor name | Target | Role |
|---|---|---|---|
| `blocks/wishlist-icon.liquid` | Wishlist icon | section | Product-page heart + optional text; Alpine.js |
| `blocks/wishlist-list.liquid` | Wishlist Listing | section | Wishlist page grid + Notes/Has/Needs modal; vanilla JS |
| `blocks/wishlist-grid-embed.liquid` | Wishlist hearts | body (app embed) | Shared pixel hearts for grids, cart page, header link |

Supporting assets:

- `assets/wishlist-grid.js` — shared controller for embed hearts
- `assets/wishlist-grid.css` — heart and header responsive styles
- `locales/en.default.json` — leftover ratings copy (not used by wishlist UI)
- `snippets/stars.liquid`, `assets/thumbs-up.png` — unused leftovers

## Hardcoded app URL

Each active block sets the backend base URL in Liquid/JS to the production host from `shopify.app.toml` (not a theme setting, not an app proxy). Search the extension for `appUrl` / `https://` when changing hosting.

Implications:

- Hosting URL changes require editing these files and running `shopify app deploy`.
- Local `shopify app dev` previews extension code, but browser calls may still hit production API unless you temporarily point `appUrl` at your tunnel (do not commit that).

## Product-page heart (`wishlist-icon`)

- Renders only the button when `customer` is present; otherwise shows a login link.
- On init, `GET /api/wishlist?customerId&productId&shop` to set filled state.
- Click toggles `POST` / `DELETE` with `customerId`, `productId`, `shop`, `variantId`.
- Merchant settings: button text, text size, alignment, icon color (default `#cf202f`).

## Listing (`wishlist-list`)

- Requires login to load items.
- `GET /api/wishlist?customerId&shop`, then for each row queries Storefront GraphQL at `/api/2025-07/graphql.json` on the shop domain for variant price, availability, image, handle.
- Modal `PUT`s notes/has/needs. Client currently requires non-empty notes before save.
- No theme-editor settings today.

## Shared grid / cart / header (`wishlist-grid-embed` + `wishlist-grid.js`)

The embed prints a JSON config tag (`data-wishlist-grid-config`) and loads `wishlist-grid.js`.

Config fields: `appUrl`, `customerId`, `shop`, `loginUrl`, `accountUrl`, `wishlistUrl`, `activeColor`.

### Theme hooks the controller expects

The extension mounts on markup the **theme** must provide:

| Hook | Purpose |
|---|---|
| `[data-wishlist-grid-product-card]` | Product card root |
| `[data-wishlist-product-id]` / `[data-wishlist-variant-id]` | Ids for API calls |
| `[data-wishlist-product-title]` | Accessible label text |
| `[data-product-media-container]` | Where the grid heart is mounted |
| `[data-swatch-variant]` | Updates the card's active variant when swatches change |
| `cart-element[data-cart-page]` | Marks the full cart page (drawer intentionally ignored) |
| `[data-wishlist-cart-item]` + `[data-wishlist-cart-actions]` | Cart line mount points |
| `[data-site-header]`, `[data-nav-icons]`, `[data-mobile-menu]`, `[data-wishlist-header-link]` | Header wishlist icon injection / cleanup |

Century storefront themes that already integrate shared wishlist controls provide these attributes. A stock theme will not show grid/cart hearts until the same hooks exist.

### Behavior notes

- Guests can see hearts; activation sends them to `loginUrl`.
- Cart hearts remount after AJAX cart DOM replacements via `MutationObserver`.
- Header wishlist link is removed if no wishlist page is selected in the embed settings.
- Extension CSS hides header hearts / header links inside `[data-site-header]` below **768px**.

## Previewing extension changes

1. `npm run dev`
2. Enable blocks/embed on the **development store** theme
3. Exercise product, grid, cart page, and listing flows as a logged-in customer
4. Release with `npm run deploy` when merging to production (see [deployment.md](deployment.md))
