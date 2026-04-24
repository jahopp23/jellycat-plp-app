import {MOCK_SHOP_API_URL} from './constants';
import type {GraphQlResponse} from './types';

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
