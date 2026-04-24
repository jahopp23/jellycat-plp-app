import {MOCK_SHOP_API_URL} from './constants';
import type {GraphQlResponse} from './types';

/**
 * `POST` to `mock.shop` (see `MOCK_SHOP_API_URL`). No in-app cache of the JSON
 * response; `Cache-Control` is set on **Remix** HTML/JSON routes, not on this
 * `fetch` call. Template routes that use `context.storefront.query` are a
 * different path (Hydrogen + worker `caches`); the men PLP uses this only.
 */
export async function mockShopFetch<TData>(
  query: string,
  variables?: Record<string, unknown>,
) {
  const response = await fetch(MOCK_SHOP_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({query, variables}),
  });

  if (!response.ok) {
    throw new Response('mock.shop request failed', {status: response.status});
  }

  const payload = (await response.json()) as GraphQlResponse<TData>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(', '));
  }

  if (!payload.data) {
    throw new Error('mock.shop returned no data');
  }

  return payload.data;
}
