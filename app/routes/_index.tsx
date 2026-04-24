import type {V2_MetaFunction} from '@shopify/remix-oxygen';
import {defer, type LoaderArgs} from '@shopify/remix-oxygen';
import {useLoaderData} from '@remix-run/react';
import {MenCollectionPlp} from '~/components/MenCollectionPlp';
import {getMenCollectionProducts} from '~/lib/mock-shop.server';

export const meta: V2_MetaFunction = () => {
  return [{title: 'Jellycat PLP | Men collection'}];
};

export async function loader({request}: LoaderArgs) {
  // The assessment is intentionally scoped to one collection. This loader keeps
  // the route thin by delegating the real Storefront work and normalization to
  // the server adapter.
  const url = new URL(request.url);
  const after = url.searchParams.get('after');
  const data = await getMenCollectionProducts({after, first: 4});
  const isPaginationRequest = Boolean(after);

  const deferredWindowPromise =
    !isPaginationRequest && data.pageInfo.hasNextPage && data.pageInfo.endCursor
      ? getMenCollectionProducts({
          after: data.pageInfo.endCursor,
          first: 4,
        })
      : Promise.resolve({
          collection: data.collection,
          pageInfo: data.pageInfo,
          products: [],
        });

  return defer(
    {
      collectionTitle: data.collection.title,
      deferredPageInfo: deferredWindowPromise.then(
        (chunk: Awaited<ReturnType<typeof getMenCollectionProducts>>) =>
          chunk.pageInfo,
      ),
      deferredProducts: deferredWindowPromise.then(
        (chunk: Awaited<ReturnType<typeof getMenCollectionProducts>>) =>
          chunk.products,
      ),
      initialPageInfo: data.pageInfo,
      initialProducts: data.products,
    },
    {
      headers: {
        'Cache-Control': isPaginationRequest
          ? 'no-store'
          : 'public, max-age=45, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}

export const headers = () => ({
  // PLP document response cache policy for drop resilience.
  'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
});

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <MenCollectionPlp
      collectionTitle={data.collectionTitle}
      deferredPageInfoPromise={data.deferredPageInfo}
      deferredProductsPromise={data.deferredProducts}
      pageInfo={data.initialPageInfo}
      products={data.initialProducts}
    />
  );
}
