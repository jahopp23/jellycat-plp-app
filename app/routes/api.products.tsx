import {json, type LoaderArgs} from '@shopify/remix-oxygen';
import {getMenCollectionProducts} from '~/lib/mock-shop.server';

export async function loader({request}: LoaderArgs) {
  const url = new URL(request.url);
  const after = url.searchParams.get('after');
  const data = await getMenCollectionProducts({after, first: 8});

  return json(data, {
    headers: {
      // Short-lived cache for high-traffic pagination reads.
      // Keeps load-more responsive while still allowing quick revalidation.
      'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=90',
    },
  });
}
