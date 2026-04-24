# Jellycat Technical Assessment: Product Listing Page

This repository implements a variant-aware Product Listing Page (PLP) and supporting PDP behavior for the Jellycat technical assessment using the `mock.shop` Storefront API within a Hydrogen v2 + Remix application.

The architecture is designed around real-world ecommerce concerns. It prioritizes product-level merchandising, bounded data fetching, progressive rendering for fast initial load, and realistic handling of inventory volatility under high-traffic conditions. The implementation is scoped to the `men` collection and avoids representing variants as separate product cards in order to preserve merchandising clarity and maintain a clean browsing experience.

**Assessment scope (routes):** the work in this document applies to the **PLP** (`/`, [`app/routes/_index.tsx`](app/routes/_index.tsx)), the **product** route used when a shopper follows a product link from the list ([`app/routes/products.$handle.tsx`](app/routes/products.$handle.tsx)), and the **list / variants** API modules those flows call. The repo still includes Hydrogen template routes such as **account** and cart shells; this assessment does **not** exercise, customize, or document those flows. Treat them as stock scaffolding, not part of the submission.

**Project deployment:** [https://jellycat-plp-assessment.vercel.app/](https://jellycat-plp-assessment.vercel.app/)

## Table of contents

Flat, **in-order** outline of every main heading (skim the doc top to bottom). For a **themed** index (caching, drops, file links), use [Reader’s map](#readers-map) under this block.

- [Local development](#local-development)
- [PageSpeed Insights](#pagespeed-insights)
- [Runtime model overview](#runtime-model-overview)
- [Part 2 — Written explanation](#part-2--written-explanation)
  - [Original assessment prompt (Part 2)](#original-assessment-prompt-part-2)
  - [Part 2 summarized answer](#part-2-summarized-answer)
  - [Variant expansion model](#variant-expansion-model)
  - [Query design](#query-design)
  - [Server / client boundary](#server--client-boundary)
  - [Trade-off](#trade-off)
- [Part 3 — Drop scenario (100× traffic spike)](#part-3--drop-scenario-100x-traffic-spike)
  - [Original assessment prompt (Part 3)](#original-assessment-prompt-part-3)
  - [Part 3 summarized answer](#part-3-summarized-answer)
  - [What breaks or degrades?](#what-breaks-or-degrades)
  - [Caching strategy](#caching-strategy)
  - [Communicating staleness](#communicating-staleness)
  - [Demo product: men’s crewneck (variant inventory and concurrency)](#demo-product-mens-crewneck-variant-inventory-and-concurrency)
  - [Pre-launch and transition to live](#pre-launch-and-transition-to-live)
  - [Performance vs availability trade-off](#performance-vs-availability-trade-off)
  - [SEO, observability, and failure handling](#seo-observability-and-failure-handling)
- [Summary](#summary)

> **On GitHub:** if an anchor does not jump (e.g. punctuation in a heading), open the README on the site, use the “link to heading” icon on that heading, and replace the hash in this list.

## Reader’s map

| Section | What you’ll find |
|--------|-------------------|
| [Table of contents](#table-of-contents) | full **in-order** list of every main section and subsection (for scanning the doc like a book). |
| [Local development](#local-development) | install, dev, and production `build` / `start`. |
| [PageSpeed Insights](#pagespeed-insights) | links to current PSI runs for the deployed app. |
| [Runtime model overview](#runtime-model-overview) | **source-of-truth numbers** for product batches, GraphQL variant `first:`, and the normalized card preview (must match `app/`). |
| [Part 2 — Written explanation](#part-2--written-explanation) | [prompt (Part 2)](#original-assessment-prompt-part-2) · [short answer](#part-2-summarized-answer) · [variant expansion](#variant-expansion-model) · [query design](#query-design) · [server / client + `Cache-Control`](#server--client-boundary) · [trade-off](#trade-off). |
| [Part 3 — Drop / 100× traffic](#part-3--drop-scenario-100x-traffic-spike) | [prompt (Part 3)](#original-assessment-prompt-part-3) · [short answer](#part-3-summarized-answer) · [degrades / caching / staleness](#what-breaks-or-degrades) · [demo product (men’s crewneck)](#demo-product-mens-crewneck-variant-inventory-and-concurrency) · [pre-launch & live](#pre-launch-and-transition-to-live) · [SEO & observability](#seo-observability-and-failure-handling) · [conclusion + business outcome](#summary). |
| [Summary](#summary) | end-to-end recap, cache `no-store` file pointers, and closing **In conclusion** (technical + business). |

Skim the **table** to jump; read **Runtime model** when checking that this document matches the repo.

## Local Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

## PageSpeed Insights

- [Desktop — PageSpeed Insights](https://pagespeed.web.dev/analysis/https-jellycat-plp-assessment-vercel-app/504hlel58b?form_factor=desktop)
- [Mobile — PageSpeed Insights](https://pagespeed.web.dev/analysis/https-jellycat-plp-assessment-vercel-app/504hlel58b?form_factor=mobile)

For a production hardening pass, I would use the PSI reports to drive fixes for the issues it calls out (for example shortening the critical request path and tightening how CSS/JS are loaded so the first paint is less blocked). Scores and diagnostics move with each deploy, so the README only links the reports.

## Runtime Model Overview

The PLP uses a progressive rendering strategy to balance performance and completeness. The route loader fetches the first four products for immediate server-side rendering, ensuring the page becomes interactive quickly. At the same time, it initiates a second request for the next four products and returns them using Remix `defer`, allowing them to stream into the UI without blocking the initial render.

This results in an initial visible set of eight products. Beyond that point, additional products are loaded only when the user explicitly requests them by clicking “Load more products.” Each load-more request fetches the next page of products in batches of eight using cursor-based pagination.

These are the **real values in code** (not a separate “constants” module of fake names). Product counts are passed into [`getMenCollectionProducts`](app/lib/mock-shop.server.ts) from the routes; variant **GraphQL** `first` comes from [`PREVIEW_VARIANT_FETCH_LIMIT`](app/lib/mock-shop/constants.ts); the **card** shows at most [`PREVIEW_VARIANT_MODEL_LIMIT`](app/lib/mock-shop/constants.ts) rows after server-side `selectPreviewVariants` (see [`app/lib/mock-shop/normalize.ts`](app/lib/mock-shop/normalize.ts)). Swatch/size **UI** limits use [`PREVIEW_COLOR_LIMIT` / `PREVIEW_SIZE_LIMIT`](app/lib/mock-shop/constants.ts) (3 each) in the client PLP when rendering preview controls.

| Concern | Where | Value |
|--------|--------|--------|
| First **SSR** product window | [`app/routes/_index.tsx`](app/routes/_index.tsx) `loader` | `getMenCollectionProducts({ first: 4, … })` |
| **Deferred** second product window (same page) | same, chained after first page’s `endCursor` | `getMenCollectionProducts({ first: 4, after: data.pageInfo.endCursor })` |
| **Load more** API | [`app/routes/api.products.tsx`](app/routes/api.products.tsx) | `getMenCollectionProducts({ first: 8, … })` → `PRODUCT_PAGE_SIZE` |
| GraphQL `variants(first: N)` for list | [`getMenCollectionProducts` variables](app/lib/mock-shop.server.ts) | `previewVariants: PREVIEW_VARIANT_FETCH_LIMIT` = **12** |
| **Normalized** `previewVariants` on `PlpProduct` | `selectPreviewVariants` in [normalize](app/lib/mock-shop/normalize.ts) | at most **5** = `PREVIEW_VARIANT_MODEL_LIMIT` |
| [Optional] The README query snippet below | illustrates shape only | `first` and `$previewVariants` are **variables**; the numbers above are the actual arguments. |

This approach ensures that above-the-fold **products** are prioritized, while the card only ships a **bounded** preview of variants even though the query may read up to 12 nodes per product from mock.shop.

# Part 2 · Written Explanation

The assessment requires explanation of variant modeling, query design, server/client boundaries, and trade-offs. 

## Original Assessment Prompt (Part 2)

From the provided assessment brief, Part 2 asks for:

- your variant expansion model (what was chosen, alternatives considered, and why),
- your query design (what is fetched at list level, what is excluded, and how it is shaped into a view model),
- your server/client boundary (what renders where, and why),
- one production trade-off you would revisit.

## Part 2 Summarized Answer

I chose a product-first variant model: each product appears once on the PLP with a small preview of variants, and the full variant list only loads when the shopper clicks “View more options.” I chose this because it keeps the page clean and easy to browse while still allowing quick add. I considered showing each variant as its own card and loading all variants upfront, but both options would add too much visual noise and data weight. At list level, I fetch only what the card needs (product identity, image, price range, options, preview variants, and pagination cursors), and I deliberately exclude full variant matrices and other deeper fields until needed. On the server, I normalize the raw Storefront response into stable `PlpProduct` and `PlpVariant` view models so the client gets a consistent shape. I drew the boundary so the server owns data correctness, normalization, and caching, while the client owns UI state and user interactions, because that keeps frontend logic simpler and avoids duplicating business rules in the browser.

**Trade-off in production:** under a real drop, the risky moment is when two people try to take the **last** unit. This project re-fetches availability when the user adds to cart, but that is still “read the current stock,” not “claim this unit in the system of record.” In production I would put the **final add** behind a **server** cart or order API that updates inventory in **one atomic step**: either the line is successfully added and stock is reserved or decremented, or the shopper gets a clear, definitive sold-out (or back-order) response. That pattern prevents two customers from both passing a timing window where each still “saw” availability.

## Variant Expansion Model

The PLP uses a product-based variant expansion model, where each product is represented by a single card and only a **bounded** preview of its variants is used initially. The list query asks mock.shop for up to **`PREVIEW_VARIANT_FETCH_LIMIT` (12)** variant nodes per product, then the server **normalizes** to at most **`PREVIEW_VARIANT_MODEL_LIMIT` (5)** `PlpVariant` rows (with additional rules for which colors/sizes show first—see [normalize](app/lib/mock-shop/normalize.ts)). That is enough to power swatch and size selection on the card without shipping the full matrix.

This decision was made to balance performance and usability. Representing each variant as its own card was rejected because it would dramatically increase the number of rendered elements, degrade scanability, and break merchandising intent. Loading all variants for every product at initial render was also rejected because it would significantly increase payload size and slow down page load time.

At the same time, requiring all variant selection to occur on a product detail page would introduce friction and reduce conversion opportunities. Instead, the system allows users to interact with a limited preview and defers full variant loading until the user explicitly requests it.

When a user selects “View more options,” the application issues a request to a product-specific endpoint:

```ts
GET /api/products/:handle/variants
```

This endpoint returns the full variant matrix for that single product, allowing the UI to expand into a complete selector. This ensures that the cost of loading full variant data is only incurred when it is needed.

An important detail for ecommerce behavior is variant selection state. In the current implementation, selection state is maintained inside each product card component and is keyed by that rendered card instance. That means selections are stable while browsing the current rendered grid, including after deferred append and load-more append, because cards remain mounted in the same list state. However, selections are not currently persisted across route transitions or full page reloads. In production, I would persist per-product selection in a lightweight client cache keyed by product ID (and optionally URL state) so users returning to the PLP keep their prior selections.

Another critical behavior is how partial selections are handled. The current card model resolves to the best matching available variant when possible. If no exact available match exists, selection resolution falls back in this order: exact unavailable match for the current option set, then the product's initial selected available variant, then the first available variant, then first variant. Quick-add uses the currently resolved selected variant and blocks add with sold-out feedback if that selected variant fails add-time validation; it does not silently substitute a different purchasable variant at click time.

## Query Design

The query design is intentionally constrained at the list level to maintain predictable performance and avoid unnecessary data transfer. The initial collection query fetches only the data required to render product cards and support basic interactions.

The core query follows this structure:

```ts
query MenCollectionProducts(
  $collectionHandle: String!
  $first: Int!
  $after: String
  $previewVariants: Int!
) {
  collection(handle: $collectionHandle) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        options {
          name
          values
        }
        variants(first: $previewVariants) {
          nodes {
            id
            availableForSale
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
            image {
              url
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

The following **runtime arguments** (see [Runtime model overview](#runtime-model-overview) table) and GraphQL **variables** apply **in the repo**:

```ts
// Collection handle: MEN_COLLECTION_HANDLE
collectionHandle = "men";
// getMenCollectionProducts `first` — from the route, not a single global:
//   index initial + deferred: 4 and 4
//   /api/products load more: 8  (PRODUCT_PAGE_SIZE)
// GraphQL men collection query (mock.shop) — from server adapter:
previewVariants: PREVIEW_VARIANT_FETCH_LIMIT; // 12
```

**Do not** read the query’s `variants(first: $previewVariants)` as “4 on the wire”: **12** is the variable value used in the adapter. The **card** still only **renders** up to **5** preview rows after normalization, which is a separate step from the raw `nodes` length. The full variant matrix is deliberately excluded from this **list** query. Instead, it is fetched on demand when the user interacts with a specific product. This ensures that large variant sets do not impact initial load performance.

All data returned from the Storefront API is normalized on the server into a simplified view model before being sent to the client. This removes the need for the frontend to interpret raw GraphQL responses and ensures a stable contract for UI rendering.

There are two important caveats worth documenting clearly. First, preview variant ordering is constrained by upstream API behavior. The current query asks for the first preview variants and then applies server-side preview modeling logic, but mock.shop does not provide a dedicated “available first” variant ordering control at query level in this implementation. As a mitigation, normalization logic prioritizes meaningful preview combinations and applies availability overrides for assessment scenarios; in production I would explicitly prioritize in-stock variants in the preview selection path for every product.

Second, option normalization is not trivial and is explicitly handled in code. Option names are canonicalized (`Color`, `Colour`, etc.), selected options are mapped to stable keys, and unique option values are derived across variants before rendering selectors. This is necessary for reliable cross-variant matching and consistent swatch/size behavior across heterogeneous catalog data.

## Server / Client Boundary

The server is responsible for all data fetching, normalization, and caching. It communicates with the mock.shop API, applies query constraints, transforms the raw data into a simplified view model, and derives product-level availability states. It also defines caching policies and ensures that only the minimal required data is sent to the client.

The server uses the following `Cache-Control` values (from route modules):

```ts
PLP `headers()` (default document / first paint):
  public, max-age=60, s-maxage=60, stale-while-revalidate=120

PLP `loader` when the URL has `?after=` (treated as a paginated first request):
  no-store

PLP `loader` for the initial deferred response (no `?after=`):
  public, max-age=45, s-maxage=60, stale-while-revalidate=120

GET /api/products (load more):
  public, max-age=15, s-maxage=30, stale-while-revalidate=90

GET /api/products/:handle/variants (expand all options for one product):
  public, max-age=2, s-maxage=5, stale-while-revalidate=15
  (on error) no-store
```

**In short:** longer TTLs + `stale-while-revalidate` for things that can be a little behind; very short TTLs (or `no-store`) for URLs or payloads where cursors, inventory, or per-user paths would make a shared cache misleading.

The client is responsible for rendering UI and handling interactions. It manages variant selection, triggers deferred data fetches, updates the UI in response to user actions, and handles quick-add functionality. It also validates availability at the moment of interaction to ensure correctness.

This boundary ensures that data logic remains centralized and efficient on the server, while the client remains lightweight and responsive.

## Trade-off

The primary trade-off in this implementation is that not all variants are visible during the initial render. This reduces the size of the initial payload and improves load performance, but it requires an additional interaction for users who want to access the full set of options.

In a production system, this trade-off could be revisited by adjusting the number of preview variants or selectively prefetching additional data for high-engagement products. The current implementation prioritizes performance and scalability, which are critical for a listing page with many products.

# Part 3 · Drop Scenario (100x Traffic Spike)

## Original Assessment Prompt (Part 3)

From the provided assessment brief, Part 3 asks for:

- what breaks or degrades under a 100x traffic drop scenario,
- what should be cached (HTML/JSON/GraphQL), for how long, and how staleness should be communicated,
- how pre-launch and go-live transition should be handled,
- the explicit trade-off between availability accuracy and performance.

## Part 3 Summarized Answer

Under a 100x drop, the first problem in this implementation is that availability can become out of date very quickly, even if the page itself still loads fast. To handle that, I would keep page and product-list data cached for short periods so the site stays fast under heavy traffic, keep image/script files cached for much longer, and check variant availability again right when the user tries to add to bag. I would also keep the UI messaging clear (for example, “Availability confirmed at checkout”) so users understand that stock can change in real time. For launch timing, I would move from hard-coded toggles to runtime feature flags or server-time rules so pre-launch and go-live behavior can be changed safely without redeploying. The clear trade-off is accepting that list-level availability may be slightly stale in exchange for a faster, more stable experience during spikes, while still enforcing stricter checks at add time where accuracy matters most.

## What Breaks or Degrades

Under a high-traffic product drop, the primary issue is data staleness rather than rendering performance. The PLP can be served quickly from cache, but the availability information it displays may no longer be accurate by the time the user interacts with it.

Additionally, if the system attempts to fetch perfectly fresh data for every request, it can overwhelm the API and increase latency. This creates a need to balance freshness and performance.

A second-order production risk is cache stampede at revalidation boundaries. If many requests hit the same expired key at once, origin pressure can spike sharply. The current implementation uses short TTLs and stale-while-revalidate semantics, but does not yet implement explicit request-collapsing logic. In production, I would add key-based request coalescing or scheduled cache warming to reduce duplicate revalidation bursts.

## Caching Strategy

**Plain summary:** one cache size does not fit all. The HTML for the first PLP view and the “load more” JSON are allowed to be **a little stale** for a **short, controlled** window so the site stays fast when traffic jumps. Anything that depends on **which page of the list you are on** or **whether this exact variant is still available** either uses a **shorter** cache, **`no-store`**, or a **fresh read at add time**—see the `Cache-Control` list above for the exact numbers.

**What that means in practice**

- The **default PLP document** is the best candidate for a warm cache: many people request the same URL, and a small lag behind the very latest data is usually acceptable.
- A **PLP URL that already includes `?after=…`** (cursor from pagination) is **`no-store`** so a paginated first load is not mixed up with the normal home page in a shared cache.
- **`GET /api/products`** (load the next set of products) is cached for **tens of seconds**, not minutes: good sharing across users who click “load more” around the same time, but the list can refresh often enough for drops and sort changes.
- **`GET /api/products/…/variants`** (full options for one product) is the **most time-sensitive** JSON: only a few seconds in shared caches. **Quick add still re-fetches** on the client right before a demo add, so the browser cache is not the last word on “can I buy this SKU right now.”

**Under spike traffic,** most visitors hit the same few URLs; those responses can be served or refreshed cheaply at the edge. Deeper pages and rarer cursors are requested less often, so lower cache hit rate there is usually an acceptable trade.

**Cursors and cache keys:** “next page” is a **different URL** for almost every step (`after=<cursor>`). So many users **share the first page**, but far fewer share the same **third or fourth** cursor—**natural cache sharding**, not a bug. In production, teams sometimes **return the next cursor in the first response** (HTML or first API) so the **common** “go to page 2” request stays **identical for more people** and stays hotter in the cache, while long-tail cursors stay cold.

## Communicating Staleness

The UI communicates availability using clear states such as available, low inventory, and sold out. It also includes messaging such as “Availability confirmed at checkout” to set expectations that final validation occurs during interaction.

If a variant becomes unavailable during interaction, the system immediately reflects that state and prevents the action, prompting the user to select another option.

This is implemented as interaction-time validation, not inventory reservation. In other words, the UI can optimistically present availability at list time, but add-time checks can still fail if another shopper claims the last unit first. The user-facing behavior is immediate: add is blocked, sold-out feedback is shown, and the UI stays consistent with the latest known state.

### Demo product: Men’s crewneck (variant inventory and concurrency)

The **Men’s crewneck** product (`men-crewneck`) is the focused demo for **variant-level inventory and concurrency** on the PLP and PDP. The server normalizer marks it as **low inventory** so the UI shows a realistic scarcity state, and the drop configuration ties it to the **“this product just sold out”** path: on add, the app waits briefly, re-fetches fresh variant data from the variants endpoint, and can deterministically treat the add as failed under the demo’s race rules. That simulates the real-world case where two shoppers try to take the last unit in the same second.

**What this is not in production:** there is no real inventory hold or line-item reservation. Success or failure is decided by a read + client-side rules for the assessment, not by a cart API that decrements stock atomically.

**What would be different in production:** the cart and checkout system would own availability. I would use **server-side add-to-cart** (or a reservation service) with **idempotent** requests, **pessimistic or optimistic locking** on inventory per variant, clear error codes for oversell, and **optional** short holds before checkout. Observability would track add failures, stock contention, and oversell rate. The low-inventory and sold-out UI would be driven by **authoritative** inventory (OMS / commerce backend), not assessment flags.

## Pre-launch and Transition to Live

Pre-launch behavior is controlled using server-side flags:

```ts
export const DROP_LIVE = true;
export const DROP_RACE_DELAY_MS = 600;
```

When a product is not yet live, it is marked as `coming_soon` and interaction is disabled. This allows the page to be fully cached before launch.

When the drop begins, the server enables interaction and triggers cache revalidation. This transition is controlled by server time to ensure consistency across users.

One known limitation is that a compile-time constant for drop state is operationally rigid. In production, I would move this to environment-driven or feature-flag-driven runtime configuration (or timestamp-based activation) and pair it with targeted cache key versioning/purge at go-live so pre-launch cached responses do not linger beyond the expected transition window. With the current route cache window, expected staleness after go-live is up to ~60 seconds unless explicitly purged sooner.

## Performance vs Availability Trade-off

The system explicitly prioritizes performance and stability over perfect real-time availability on the PLP. Attempting to keep availability perfectly synchronized would significantly increase system load and degrade performance during high-traffic events.

Instead, the PLP provides a best-effort representation of availability, and final validation occurs at the moment of interaction. This ensures that the system remains responsive while still maintaining correctness where it matters most.

## SEO, Observability, and Failure Handling

The progressive rendering strategy intentionally optimizes user-perceived performance, but it has SEO implications that must be acknowledged. The first four products are guaranteed in immediate route payload, while the next four stream via defer. In production, I would explicitly validate crawler behavior and, if necessary, serve a crawler-safe mode that includes the full first set in the initial server payload. I would also add **JSON-LD** for the collection: for example, a `CollectionPage` (or `ItemList`) with stable URLs and a machine-readable list of the products in the first page (names, links, and optionally `Offer`/`AggregateOffer` where appropriate), so search engines that rely on structured data can interpret the page as a real catalog result without depending on how much HTML streamed after first paint.

For observability, I would track at minimum: PLP and pagination cache hit ratio, API error/timeout rate to upstream storefront data, P95 time to first variant interaction, and the rate of add-time availability corrections. These metrics provide early warning when drop traffic causes stale-data drift or upstream degradation.

For upstream failure behavior, the product goal is graceful degradation. Existing cards should remain usable if a subsequent fetch fails, variant expansion failures should surface clear inline messaging, and pagination failures should fail softly without wiping current product state. In production, I would enforce explicit budgets and breaker thresholds, for example: 2s timeout for variant expansion calls, 3s timeout for paginated list calls, open circuit after 3 consecutive upstream timeouts/errors, hold circuit open for 10s, then probe half-open with one trial request.

## Summary

This implementation delivers a production-minded foundation for a headless ecommerce PLP by combining clear merchandising behavior with controlled data cost. The page models products at the product-card level (rather than variant-as-card), keeps initial payloads bounded, and progressively expands complexity only when user intent is explicit. In practical terms, the runtime strategy (SSR first set, deferred continuation, then user-driven pagination) improves first paint and interaction readiness while still supporting deeper catalog exploration.

From a data architecture perspective, the system separates concerns cleanly: server-side modules own query transport, normalization, availability derivation, and cache policy decisions; the client owns rendering, option interaction state, and user-triggered fetches such as load-more, variant expansion, and add-time checks. This keeps frontend UI logic simpler and more resilient while making data contracts explicit and stable.

From an operational perspective, the implementation lines up **how stale the UI is allowed to be** with **how much it costs to stay fresh**. **List-level availability is best-effort** because the PLP comes from **cached, batched** fetches. By the time a shopper sees a badge or price, someone else may already have bought the last unit, or a cache may still be showing a few seconds of age. The listing does not **hold** inventory, so that row is a **reasonable snapshot in time**, not a guarantee the SKU is still there.

**Interaction-time checks are the “authoritative” step in this app (relative to the list):** they run **at the last moment before add**, on purpose fresher than the first paint. Here that means a **re-fetch of variant data** and a hard block on add if the data says sold out; in production the same *job* would usually sit in a **server cart or order service**, not a browser. “Authoritative” does not mean legally final—it means **this is the check you trust to decide the action**, not the older pixels on the card.

**TTLs are tuned to volatility in a straightforward way:** if the answer is allowed to be slightly old without serious harm, TTL + `stale-while-revalidate` can be **longer** (PLP, load more). If the answer changes fast, is **per-user** (cursors in the URL), or is **stock-sensitive** (per-product variants), TTLs are **shorter** and the UI leans on **re-read at action time** again. **`no-store` is not scattered at random; it is used where a shared or browser cache would be wrong or unsafe:**
- **[`app/routes/_index.tsx`](app/routes/_index.tsx) loader, when the request URL has `?after=…`:** the response is a **cursor-scoped** first document, not the default PLP at `/`. **`no-store`** keeps a **paginated entry** from being **stored as the canonical home document** in a shared cache, which would be the wrong list slice for other shoppers hitting `/`.
- **[`app/routes/api.products.$handle.variants.tsx`](app/routes/api.products.$handle.variants.tsx) on the error / catch path:** the JSON for “expand options” failed. **`no-store`** avoids **caching a failure (or half-response) as if it were a successful** variant matrix the next time someone opens that product.
- **Load more from the client** ([`app/hooks/useMenPlpCollection.ts`](app/hooks/useMenPlpCollection.ts)): the `fetch` to `GET /api/products?…` uses `cache: 'no-store'` so the **browser** does not hand back a **stale page of products** from its HTTP cache when the user loads the next chunk.

The rest of this document (selection persistence, stale windows, cache stampede, cursor keys, deferred/SEO, upstream failure handling) is where the assessment build stops and production hardening would keep going.

**What the implementation is doing (and why, against the brief):** the list is less expensive to render and fetch than a variant-per-row grid or loading a full matrix for every line because **product-level cards and preview variants** bound payload and DOM. The index route **server-renders a small first set** and **streams the next batch** so the first screen is not waiting on the entire first page in one monolithic pass. Deeper fetches—**load more** and the **per-product full variant matrix**—run only on explicit user action, so cost tracks **user-driven** requests from the exercise (pagination, expansion) instead of every visit paying for a worst-case catalog.

**Normalization** into `PlpProduct` / `PlpVariant` keeps option naming, availability, and assessment demos out of ad hoc UI string checks: there is **one** server-owned place to change behavior. **Per-route `Cache-Control` in code** makes the “fast vs fresh” trade **auditable** (headers, not just README adjectives). The **add-time re-fetch** before a demo add encodes the real rule that **a cached listing is not a stock hold**; with a real cart, the same idea moves to a **server-side** check or transaction, but the **layering** (list vs commit) stays.

In conclusion, this assessment delivers a working **men’s collection PLP** on **`mock.shop`**: **product-level cards** with a **small variant preview**, a **first paint** from **SSR of an initial batch** plus **deferred** products, **load more** with **cursor pagination**, and **per-product “more options”** fetches for the full variant matrix on demand. The server **normalizes** upstream data into **stable `PlpProduct` / `PlpVariant` models**, sets **explicit `Cache-Control`** on the PLP and related API responses, and the **quick-add** path **re-fetches** variant data so a listing is not treated as a stock reservation. That is the end-to-end behavior the assessment brief asks to justify in writing and in code. The same design choices are what a revenue-focused team needs from a PLP in production: a page that **loads quickly and remains usable** when traffic spikes, **keeps add-to-cart within the listing** for common paths, and **aligns work and cost** with what shoppers actually do (progressive loading, explicit expansion, a fresh check at add) instead of over-fetching on every visit. Stated in business terms, that supports **higher conversion and AOV** (less friction, clearer options), **stronger performance during high-traffic selling windows** (drops, promos) without timeouts or false “in stock” signals, and **lower cost of bad inventory UX** (abandonment, support load, and trust erosion) because the experience matches real availability. The collection page is the top of the funnel; this pattern is about turning **visits into orders** at scale.
