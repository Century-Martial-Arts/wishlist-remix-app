/* eslint-disable no-unused-expressions, no-sequences */
"use strict";
(() => {
  const CARD_SELECTOR = "[data-wishlist-grid-product-card]",
    MEDIA_SELECTOR = "[data-product-media-container]",
    SWATCH_SELECTOR = "[data-swatch-variant]",
    BUTTON_SELECTOR = "[data-wishlist-grid-heart]",
    HEADER_SELECTOR = "[data-site-header]",
    HEADER_LINK_SELECTOR = "[data-wishlist-header-link]",
    CONFIG_SELECTOR = "[data-wishlist-grid-config]",
    CONTROLLER_KEY = "__centuryWishlistGridController",
    PIXEL_HEART_SVG =
      '<svg aria-hidden="true" focusable="false" class="wishlist-pixel-heart" viewBox="0 0 31 31" shape-rendering="crispEdges"><path d="M6 5H12V8H15V11H16V8H19V5H25V8H28V14H25V17H22V20H19V23H16V26H15V23H12V20H9V17H6V14H3V8H6Z"/></svg>',
    configElements = document.querySelectorAll(CONFIG_SELECTOR),
    configElement = configElements[configElements.length - 1];
  if (!configElement) return;
  let config;
  try {
    config = JSON.parse(configElement.textContent);
  } catch (error) {
    console.error("Wishlist grid configuration could not be read.", error);
    return;
  }
  class WishlistGridController {
    constructor(initialConfig) {
      ((this.savedVariantIds = /* @__PURE__ */ new Set()),
        (this.requestLocks = /* @__PURE__ */ new Map()),
        (this.stateReady = !1),
        (this.statePromise = null),
        (this.liveRegion = null),
        this.updateConfig(initialConfig),
        (this.handleClick = this.handleClick.bind(this)),
        (this.handleSwatchClick = this.handleSwatchClick.bind(this)),
        (this.handleMutations = this.handleMutations.bind(this)));
    }
    updateConfig(nextConfig) {
      this.config = {
        appUrl: String(nextConfig.appUrl || "").replace(/\/$/, ""),
        customerId: nextConfig.customerId ? String(nextConfig.customerId) : "",
        shop: String(nextConfig.shop || ""),
        loginUrl: String(nextConfig.loginUrl || "/account/login"),
        accountUrl: String(nextConfig.accountUrl || "/account"),
        wishlistUrl: String(nextConfig.wishlistUrl || ""),
        activeColor: String(nextConfig.activeColor || "#cf202f"),
      };
    }
    start() {
      (this.ensureLiveRegion(),
        this.initializeCards(document),
        this.initializeHeaders(document),
        document.addEventListener("click", this.handleClick, !0),
        document.addEventListener("click", this.handleSwatchClick),
        new MutationObserver(this.handleMutations).observe(document.body, {
          childList: !0,
          subtree: !0,
        }),
        this.config.customerId
          ? this.ensureWishlistState()
          : ((this.stateReady = !0), this.refreshAllButtons()));
    }
    ensureLiveRegion() {
      this.liveRegion?.isConnected ||
        ((this.liveRegion = document.createElement("div")),
        (this.liveRegion.className = "wishlist-grid-status"),
        this.liveRegion.setAttribute("role", "status"),
        this.liveRegion.setAttribute("aria-live", "polite"),
        this.liveRegion.setAttribute("aria-atomic", "true"),
        document.body.appendChild(this.liveRegion));
    }
    announce(message) {
      (this.ensureLiveRegion(),
        (this.liveRegion.textContent = ""),
        window.setTimeout(() => {
          this.liveRegion.textContent = message;
        }, 20));
    }
    initializeCards(root) {
      (root instanceof Element || root instanceof Document) &&
        (root instanceof Element &&
          root.matches(CARD_SELECTOR) &&
          this.mountCard(root),
        root
          .querySelectorAll(CARD_SELECTOR)
          .forEach((card) => this.mountCard(card)));
    }
    initializeHeaders(root) {
      if (!(root instanceof Element || root instanceof Document)) return;
      const headers = /* @__PURE__ */ new Set();
      if (root instanceof Element) {
        root.matches(HEADER_SELECTOR) && headers.add(root);
        root.closest(HEADER_SELECTOR) &&
          headers.add(root.closest(HEADER_SELECTOR));
      }
      root
        .querySelectorAll(HEADER_SELECTOR)
        .forEach((header) => headers.add(header));
      headers.forEach((header) => this.mountHeader(header));
    }
    mountHeader(header) {
      if (!this.config.wishlistUrl) {
        header.querySelectorAll(HEADER_LINK_SELECTOR).forEach((link) => {
          const wrapper = link.closest(".menu__item");
          wrapper ? wrapper.remove() : link.remove();
        });
        return;
      }
      header.querySelectorAll(HEADER_LINK_SELECTOR).forEach((link) => {
        link.href = this.config.wishlistUrl;
      });
      const desktopIcons = header.querySelector("[data-nav-icons]"),
        compressedIcons = header.querySelector(".menu__item--compress"),
        mobileIcons = header.querySelector("[data-mobile-menu]");
      desktopIcons && this.mountDesktopHeaderLink(desktopIcons);
      compressedIcons && this.mountCompactHeaderLink(compressedIcons, !1);
      mobileIcons && this.mountCompactHeaderLink(mobileIcons, !0);
    }
    mountDesktopHeaderLink(container) {
      if (container.querySelector(HEADER_LINK_SELECTOR)) return;
      const accountLink = Array.from(
          container.querySelectorAll("a[href]"),
        ).find((link) => this.urlsMatch(link.href, this.config.accountUrl)),
        targetItem =
          accountLink?.closest(".menu__item") ||
          container.querySelector(".cart__toggle")?.closest(".menu__item");
      if (!targetItem) return;
      const wrapper = document.createElement("div"),
        link = this.createHeaderLink(
          "navlink navlink--icon wishlist-header-heart",
        );
      wrapper.className = "menu__item menu__item--icon";
      wrapper.appendChild(link);
      container.insertBefore(wrapper, targetItem);
    }
    mountCompactHeaderLink(container, isMobile) {
      if (container.querySelector(HEADER_LINK_SELECTOR)) return;
      const cartLink = container.querySelector(".cart__toggle");
      if (!cartLink) return;
      const link = this.createHeaderLink(
        isMobile
          ? "mobile-menu__button wishlist-header-heart"
          : "navlink navlink--icon wishlist-header-heart",
      );
      if (isMobile) {
        container.insertBefore(link, cartLink);
        return;
      }
      const targetItem = cartLink.closest(".menu__item");
      if (!targetItem) return;
      const wrapper = document.createElement("div");
      wrapper.className = "menu__item menu__item--icon";
      wrapper.appendChild(link);
      container.insertBefore(wrapper, targetItem);
    }
    createHeaderLink(className) {
      const link = document.createElement("a");
      link.href = this.config.wishlistUrl;
      link.className = className;
      link.dataset.wishlistHeaderLink = "";
      link.setAttribute("aria-label", "View wishlist");
      link.innerHTML = PIXEL_HEART_SVG;
      return link;
    }
    urlsMatch(firstUrl, secondUrl) {
      try {
        const first = new URL(firstUrl, window.location.origin),
          second = new URL(secondUrl, window.location.origin),
          normalizePath = (path) => path.replace(/\/$/, "") || "/";
        return normalizePath(first.pathname) === normalizePath(second.pathname);
      } catch (error) {
        return !1;
      }
    }
    mountCard(card) {
      if (card.querySelector(BUTTON_SELECTOR)) return;
      const productId = card.dataset.wishlistProductId,
        variantId = card.dataset.wishlistVariantId,
        media = card.querySelector(MEDIA_SELECTOR);
      if (!productId || !variantId || !media) return;
      const button = document.createElement("button");
      ((button.type = "button"),
        (button.className = "wishlist-grid-heart"),
        (button.dataset.wishlistGridHeart = ""),
        (button.dataset.wishlistProductId = productId),
        (button.dataset.wishlistVariantId = variantId),
        (button.dataset.wishlistProductTitle =
          card.dataset.wishlistProductTitle || "this item"),
        button.style.setProperty(
          "--wishlist-grid-active-color",
          this.config.activeColor,
        ),
        (button.innerHTML = PIXEL_HEART_SVG),
        media.appendChild(button),
        this.updateButton(button));
    }
    handleMutations(mutations) {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          node instanceof Element && this.initializeCards(node);
          node instanceof Element && this.initializeHeaders(node);
        });
      });
    }
    handleSwatchClick(event) {
      const swatch = event.target.closest(SWATCH_SELECTOR);
      if (!swatch) return;
      const card = swatch.closest(CARD_SELECTOR),
        variantId = swatch.dataset.swatchVariant;
      if (!card || !variantId) return;
      card.dataset.wishlistVariantId = variantId;
      const button = card.querySelector(BUTTON_SELECTOR);
      button &&
        ((button.dataset.wishlistVariantId = variantId),
        this.updateButton(button));
    }
    async handleClick(event) {
      const button = event.target.closest(BUTTON_SELECTOR);
      if (!button) return;
      if (
        (event.preventDefault(),
        event.stopPropagation(),
        !this.config.customerId)
      ) {
        window.location.assign(this.config.loginUrl);
        return;
      }
      const variantId = button.dataset.wishlistVariantId,
        productId = button.dataset.wishlistProductId,
        productTitle = button.dataset.wishlistProductTitle || "Item";
      !variantId ||
        !productId ||
        this.requestLocks.has(variantId) ||
        (!this.stateReady && !(await this.ensureWishlistState())) ||
        (await this.toggleVariant({ productId, variantId, productTitle }));
    }
    async ensureWishlistState() {
      if (this.stateReady) return !0;
      if (this.statePromise) return this.statePromise;
      ((this.statePromise = this.fetchWishlistState()),
        this.refreshAllButtons());
      try {
        return (await this.statePromise, (this.stateReady = !0), !0);
      } catch (error) {
        return (
          console.error("Wishlist state could not be loaded.", error),
          this.announce(
            "Wishlist is temporarily unavailable. Activate a heart to try again.",
          ),
          !1
        );
      } finally {
        ((this.statePromise = null), this.refreshAllButtons());
      }
    }
    async fetchWishlistState() {
      const url = new URL(`${this.config.appUrl}/api/wishlist`);
      (url.searchParams.set("customerId", this.config.customerId),
        url.searchParams.set("shop", this.config.shop));
      const response = await fetch(url, {
          headers: { Accept: "application/json" },
        }),
        payload = await response.json();
      if (!response.ok || payload?.ok === !1 || !Array.isArray(payload?.data))
        throw new Error(
          payload?.message || `Wishlist request failed with ${response.status}`,
        );
      this.savedVariantIds = new Set(
        payload.data
          .map((item) => item?.variantId)
          .filter(Boolean)
          .map(String),
      );
    }
    async toggleVariant({ productId, variantId, productTitle }) {
      const wasSaved = this.savedVariantIds.has(variantId),
        willBeSaved = !wasSaved;
      willBeSaved
        ? this.savedVariantIds.add(variantId)
        : this.savedVariantIds.delete(variantId);
      const request = this.persistVariant({
        productId,
        variantId,
        saved: willBeSaved,
      });
      (this.requestLocks.set(variantId, request),
        this.refreshVariantButtons(variantId));
      try {
        (await request,
          this.announce(
            `${productTitle} ${willBeSaved ? "added to" : "removed from"} your wishlist.`,
          ));
      } catch (error) {
        (wasSaved
          ? this.savedVariantIds.add(variantId)
          : this.savedVariantIds.delete(variantId),
          console.error("Wishlist item could not be updated.", error),
          this.announce(
            `${productTitle} could not be updated. Please try again.`,
          ));
      } finally {
        (this.requestLocks.delete(variantId),
          this.refreshVariantButtons(variantId));
      }
    }
    async persistVariant({ productId, variantId, saved }) {
      const formData = new FormData();
      (formData.append("customerId", this.config.customerId),
        formData.append("productId", productId),
        formData.append("variantId", variantId),
        formData.append("shop", this.config.shop));
      const response = await fetch(`${this.config.appUrl}/api/wishlist`, {
          method: saved ? "POST" : "DELETE",
          body: formData,
        }),
        payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === !1)
        throw new Error(
          payload?.message || `Wishlist update failed with ${response.status}`,
        );
    }
    refreshAllButtons() {
      document
        .querySelectorAll(BUTTON_SELECTOR)
        .forEach((button) => this.updateButton(button));
    }
    refreshVariantButtons(variantId) {
      document.querySelectorAll(BUTTON_SELECTOR).forEach((button) => {
        button.dataset.wishlistVariantId === variantId &&
          this.updateButton(button);
      });
    }
    updateButton(button) {
      const variantId = button.dataset.wishlistVariantId,
        productTitle = button.dataset.wishlistProductTitle || "this item",
        isGuest = !this.config.customerId,
        isLoadingState =
          !isGuest && !this.stateReady && Boolean(this.statePromise),
        isUnknownState = !isGuest && !this.stateReady && !this.statePromise,
        isWriting = this.requestLocks.has(variantId),
        isSaved = this.stateReady && this.savedVariantIds.has(variantId);
      (button.style.setProperty(
        "--wishlist-grid-active-color",
        this.config.activeColor,
      ),
        button.setAttribute("aria-pressed", String(isSaved)),
        button.toggleAttribute("disabled", isLoadingState || isWriting),
        button.setAttribute("aria-busy", String(isLoadingState || isWriting)),
        isUnknownState
          ? (button.dataset.wishlistState = "unknown")
          : delete button.dataset.wishlistState,
        isGuest
          ? button.setAttribute(
              "aria-label",
              `Sign in to save ${productTitle} to your wishlist`,
            )
          : isLoadingState
            ? button.setAttribute(
                "aria-label",
                `Loading wishlist status for ${productTitle}`,
              )
            : isUnknownState
              ? button.setAttribute(
                  "aria-label",
                  `Retry wishlist status for ${productTitle}`,
                )
              : button.setAttribute(
                  "aria-label",
                  `${isSaved ? "Remove" : "Add"} ${productTitle} ${isSaved ? "from" : "to"} your wishlist`,
                ));
    }
  }
  if (window[CONTROLLER_KEY]) {
    (window[CONTROLLER_KEY].updateConfig(config),
      window[CONTROLLER_KEY].initializeCards(document),
      window[CONTROLLER_KEY].initializeHeaders(document),
      window[CONTROLLER_KEY].refreshAllButtons());
    return;
  }
  const controller = new WishlistGridController(config);
  ((window[CONTROLLER_KEY] = controller), controller.start());
})();
