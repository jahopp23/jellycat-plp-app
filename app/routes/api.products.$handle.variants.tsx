import {json, type LoaderArgs} from '@shopify/remix-oxygen';
import {getProductVariantMatrix} from '~/lib/mock-shop.server';

export function loader({params}: LoaderArgs) {
  // This route exists solely for deferred expansion from the PLP. It keeps the
  // "fetch more options" path server-side and product-scoped.
  const handle = params.handle;

  if (!handle) {
    throw new Response('Product handle is required', {status: 400});
  }

  return getProductVariantMatrix(handle)
    .then((product: Awaited<ReturnType<typeof getProductVariantMatrix>>) =>
      json(
        {product},
        {
          headers: {
            // Variant availability is semi-stale and shortest-lived in drop mode.
            'Cache-Control':
              'public, max-age=2, s-maxage=5, stale-while-revalidate=15',
          },
        },
      ),
    )
    .catch(() =>
      json(
        {
          error: 'Unable to load more options right now.',
          product: null,
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    );
}
