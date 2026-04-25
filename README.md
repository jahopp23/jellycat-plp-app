# Jellycat Technical Assessment: Product Listing Page

This project implements a Product Listing Page (PLP) for the Jellycat technical assessment using the `mock.shop` Storefront API in a Hydrogen v2 + Remix application. The focus of the implementation is how product variants are modeled at the list level, how data is fetched and shaped, and how the system behaves under real-world ecommerce constraints such as performance and rapidly changing inventory.

The architecture is intentionally product-based. Each product appears once in the listing, and variant complexity is progressively revealed based on user interaction. This keeps the initial experience fast and readable while still supporting full product configuration when needed.

## Vercel deployment
[https://jellycat-plp-app.vercel.app/](https://jellycat-plp-app.vercel.app/)

## PageSpeed
Mobile: [https://pagespeed.web.dev/analysis/https-jellycat-plp-app-vercel-app/vzrmlh8o7k?form_factor=mobile](https://pagespeed.web.dev/analysis/https-jellycat-plp-app-vercel-app/vzrmlh8o7k?form_factor=mobile)

Desktop: [https://pagespeed.web.dev/analysis/https-jellycat-plp-app-vercel-app/vzrmlh8o7k?form_factor=desktop](https://pagespeed.web.dev/analysis/https-jellycat-plp-app-vercel-app/vzrmlh8o7k?form_factor=desktop)

## Local development

```bash
npm install --legacy-peer-deps
npm run dev
```

CI / deploy check (Vercel runs the build; there is no local `npm start` after it):

```bash
npm run build
```

# Part 2: Written explanation

## Variant expansion model

The PLP uses a product-based variant expansion model. Each product is represented as a single card, and only a limited preview of its variants is loaded initially. This preview allows the user to interact with common options such as color and size and supports quick add directly from the listing.

This approach was chosen to balance performance and usability. Rendering each variant as its own card would significantly increase the number of items on the page, reduce scanability, and distort merchandising intent. Loading all variants for every product upfront would increase payload size and slow down the initial render.

At the same time, forcing all variant selection onto a product detail page would introduce unnecessary friction. Instead, the system allows interaction with a preview set and defers full variant loading until the user explicitly requests it.

When a user clicks “View more options,” the application fetches the full variant matrix for that specific product only. This ensures that additional data is loaded only when there is clear user intent.

In a production system, this model would remain the same, but the preview size could be tuned dynamically based on product complexity or user behavior. For example, products with fewer variants could expose all options immediately, while more complex products would continue to use the preview-and-expand model.


## Query design

The query design is intentionally constrained at the list level to keep the initial payload small, predictable, and fast to render.

At the PLP level, the server fetches only the data required to render product cards and support basic interaction. This includes product identity (id, handle, title), imagery, price range, option metadata (such as color and size), and a limited set of variants. Variant data is capped to a small preview set (four per product), which is sufficient to power color swatches, size selection, and quick add behavior.

The initial render fetches four products, and an additional four are streamed using Remix defer, resulting in eight visible products. Pagination is handled using cursors, with subsequent requests fetching additional products in batches when the user clicks “Load more.”

The query deliberately excludes the full variant matrix for each product. Fetching all variants at the list level would significantly increase payload size, especially for products with multiple options, and is not necessary for the majority of interactions on a listing page. Instead, full variant data is fetched on demand through a separate endpoint when the user selects “View more options” for a specific product.

After fetching data from the Storefront API, the server normalizes the response into a simplified view model before sending it to the client. This model flattens the GraphQL structure into a predictable shape, extracts relevant option groupings (such as colors and sizes), and derives product-level availability from the variant preview set. By shaping the data on the server, the client does not need to interpret raw GraphQL responses and can remain focused on rendering and interaction.

In a production system, this approach would be extended by separating product metadata from availability at the query level. Product data could be cached more aggressively, while availability would be fetched or validated independently to improve both performance and accuracy


## Server / client boundary

The server is responsible for all data fetching and shaping. It communicates with the mock.shop API, applies limits to product and variant counts, normalizes the data into a clean view model, and defines caching behavior. This ensures that data logic remains centralized and consistent.

The client is responsible for rendering the UI and handling user interaction. It manages variant selection, triggers deferred data fetching for expanded variants, handles pagination, and performs quick add actions. It also validates availability at the moment of interaction to ensure that the selected variant is still valid.

This boundary was chosen to keep the client lightweight and focused on interactivity while ensuring that all data transformation and constraints are enforced on the server.

In a production system, this boundary would be reinforced by introducing a server-side cart or order service. Instead of relying on client-driven availability checks, the server would perform the final validation and mutation, ensuring that inventory is enforced at the point of write.


## Trade-off to revisit in production

The primary trade-off in this implementation is that not all variants are visible on initial render. This improves performance and reduces payload size but requires an additional interaction for users who want to see the full set of options.

This decision prioritizes speed and scalability, which are critical for a listing page that may contain many products with complex variant combinations.

In production, this trade-off could be revisited by adapting the preview size based on product type or user behavior. Additionally, selective prefetching could be introduced for high-intent interactions, reducing the need for a secondary fetch without increasing the cost of the initial render.


# Part 3: Drop scenario

## What breaks or degrades

Under a high-traffic product drop scenario, the primary issue in the current implementation is that availability shown on the PLP can become stale. Because the page and product list are cached, a product may appear available when the page is rendered, but sell out before the user completes an interaction. This creates a mismatch between what the user sees and what is actually available.

The current implementation also relies on read-time availability checks and client-side revalidation before add-to-cart. While this reduces obvious inconsistencies, it is not authoritative. Under heavy load, race conditions can still occur when multiple users attempt to purchase the same remaining inventory.

Attempting to solve this by making every request fully real-time would increase load on the API and degrade performance during the traffic spike.

In a production system, I would address this by separating product metadata from availability, allowing the PLP to remain aggressively cached while treating inventory as dynamic. I would also move the add-to-cart operation to a server-side cart or order service that performs atomic validation and mutation. Finally, I would introduce event-driven cache invalidation or shorter-lived availability caches so that major inventory changes propagate quickly without requiring every request to bypass cache.


## What to cache, for how long, and how to communicate staleness

During a drop, caching is used to protect performance while accepting that some data will be temporarily stale. The specific cache durations used in this implementation are representative rather than prescriptive. They are chosen to demonstrate how different layers of data can be treated based on volatility, not to suggest exact production values.

In this implementation, **PLP** responses (`app/routes/_index.tsx`) use `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=120` for the main document (cursor pagination with `?after=` is `no-store` so a cursor is not conflated with `/`). That is roughly **30s in the browser and 60s in shared caches**, with possible background revalidation for up to **120s**. In a production system, these numbers would be tuned; the pattern is: cache **structure and catalog-ish** data briefly, not live inventory, on the list.

**Product list** JSON (`GET /api/products`, `app/routes/api.products.tsx`) is shorter: `max-age=15, s-maxage=30, stale-while-revalidate=90` — a **~15s / ~30s** read path for “load more” than the PLP document.

**GraphQL queries (assessment / men collection) live in** [`app/lib/mock-shop/queries.ts`](app/lib/mock-shop/queries.ts):

| Query (operation) | Used for | Called from |
|-------------------|----------|-------------|
| `MenCollectionProducts` |Collection cursor page + **preview** variants (variable `previewVariants`)|`getMenCollectionProducts` → list loaders, [`/api/products`](app/routes/api.products.tsx) |
| `MenPlpProductVariants` (paginated) | **Full** variant matrix for one `handle` |`getProductVariantMatrix` → [`/api/products/:handle/variants`](app/routes/api.products.$handle.variants.tsx) (and product route where needed) |

The **full variant** JSON for “more options” (`app/routes/api.products.$handle.variants.tsx`) is HTTP-cached only a **few** seconds: `max-age=2, s-maxage=5, stale-while-revalidate=15` (errors: `no-store`). The client may **re-validate** availability at add time; in a full BFF you would often split “catalog” vs “stock” fetches. This repo keeps a single `mockShopFetch` without a separate GQL key-value store.

To communicate staleness, the UI treats availability as a best-effort state and includes messaging such as “Availability confirmed at checkout.” If a user attempts to add a variant that has sold out, the action fails gracefully and prompts the user to select another option.

The pattern is: **longer** `Cache-Control` for the **PLP and list JSON** (bounded staleness) and **shorter** for the **per-product variant** JSON, while **outbound `POST` GraphQL** is only indirectly bounded by those HTTP layers.


## Pre-launch and go-live

Before a product drop goes live, products can be displayed in a “coming soon” state with interactions disabled. This allows the page to be fully cached and ready to serve traffic efficiently.

At go-live, a server-controlled flag enables interactions and triggers cache revalidation. This ensures that all users see the same state at the same time and avoids inconsistencies caused by client-side timing.

In production, this would be managed through feature flags or environment configuration, along with targeted cache invalidation to prevent stale pre-launch content from persisting after the drop begins.


## Trade-off: accuracy vs performance

The system prioritizes performance and stability over perfect real-time accuracy on the PLP. Keeping the listing perfectly synchronized with inventory would significantly increase system load and reduce responsiveness during high-traffic events.

Instead, the PLP provides a best-effort view of availability, and final validation occurs at the point of interaction. In a production system, this validation would be enforced by a server-side cart or order service acting as the source of truth.

This approach ensures that the system remains scalable and performant while maintaining correctness where it matters most.


## What we would do differently in production

At write time, I would move the final add-to-cart flow to a server-side cart layer that integrates with Shopify’s cart or checkout APIs, ensuring that inventory is validated at mutation time rather than relying on client-side re-reads.

I would separate catalog and availability concerns more explicitly. Product metadata such as titles, images, and options would be fetched and cached independently from availability, while inventory would either be fetched through a dedicated availability layer or validated during interaction. This allows each type of data to use different cache strategies, TTLs, or event-driven invalidation when products go live or sell out.

Configuration and go-live behavior would be managed through environment configuration or feature flags rather than hardcoded constants. At launch, I would trigger targeted cache invalidation or revalidation for the PLP and product list JSON so that pre-launch content does not persist after products become available.

For observability and resilience, I would add monitoring around Storefront API latency, route performance, and error rates during traffic spikes. This would help ensure the system remains stable and responsive under load.

Finally, I would treat variant preview depth and deferred loading behavior as configurable rather than fixed. In production, these values would be adjusted based on real user behavior and performance data rather than a single static constant.

These changes build on the existing architecture. The current implementation is intentionally a readable baseline that demonstrates how the PLP is structured, how variant data is shaped, and how HTTP caching is applied on top of mock.shop fetches.

## Demo Scenarios (Intentional Edge Cases)

To make variant handling and availability states explicit in the UI, a few products are intentionally configured to demonstrate edge cases:

The Men’s Crewneck product includes a variant that is unavailable. Selecting this option surfaces the “This option is not available” state in the UI and demonstrates how disabled variants are handled at the list and interaction level.

The Canvas Sneakers product is used to represent a pre-launch state. It is rendered as “Coming soon,” with interactions disabled, to demonstrate how products can be shown before go-live while remaining cacheable and safe under traffic.

These scenarios are intentionally introduced for the assessment so that sold-out variants, disabled selections, and pre-launch behavior are visible and testable without relying on live inventory change

## Summary

This implementation reflects a production-minded approach to building a PLP in a headless Shopify storefront. It prioritizes fast initial render through constrained queries and progressive loading, ensuring that above-the-fold content is delivered quickly while additional data is fetched only when needed. By modeling variants at the product level rather than expanding them into separate entries, the interface remains clear, scannable, and aligned with merchandising intent.

The data layer is designed to minimize unnecessary payload size while still supporting meaningful interaction. Variant data is intentionally bounded on initial load and expanded only when the user expresses intent, which allows the system to scale across products with varying levels of complexity without degrading performance. This approach keeps the client lightweight and focused on interaction, while the server owns data shaping, normalization, and caching decisions.

At the same time, the implementation treats availability as inherently volatile. The PLP is allowed to remain cacheable and fast, while inventory is validated closer to the point of interaction. This separation ensures that browsing performance is preserved without compromising correctness where it matters most. Under high-traffic conditions, this design avoids unnecessary pressure on the Storefront API while still providing a consistent and predictable user experience.

Overall, the system balances performance, usability, and correctness by limiting initial data, deferring complexity until user intent is clear, and validating critical information at the moment of interaction. The result is a PLP that performs efficiently under normal conditions, remains resilient during high-traffic events, and provides a clear and intuitive path to purchase while leaving room for production-level enhancements such as server-side cart validation and more granular data separation.
