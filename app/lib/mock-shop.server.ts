import {
  FULL_VARIANT_PAGE_SIZE,
  MEN_COLLECTION_HANDLE,
  PREVIEW_VARIANT_FETCH_LIMIT,
  PRODUCT_PAGE_SIZE,
} from './mock-shop/constants';
import {mockShopFetch} from './mock-shop/fetch';
import {normalizeProduct} from './mock-shop/normalize';
import {
  MEN_COLLECTION_PRODUCTS_QUERY,
  PRODUCT_VARIANTS_QUERY,
} from './mock-shop/queries';
import type {
  MenCollectionProductsResponse,
  MenCollectionResult,
  ProductVariantsPageResponse,
  VariantNode,
} from './mock-shop/types';

export async function getMenCollectionProducts({
  after,
  first = PRODUCT_PAGE_SIZE,
}: {
  after?: string | null;
  first?: number;
} = {}): Promise<MenCollectionResult> {
  // Keep PLP product modeling anchored to men collection with real cursor pagination.
  const response = await mockShopFetch<MenCollectionProductsResponse>(
    MEN_COLLECTION_PRODUCTS_QUERY,
    {
      after: after ?? null,
      collectionHandle: MEN_COLLECTION_HANDLE,
      first,
      previewVariants: PREVIEW_VARIANT_FETCH_LIMIT,
    },
  );

  if (!response.collection) {
    throw new Response('Men collection not found', {status: 404});
  }

  return {
    collection: {
      id: response.collection.id,
      handle: response.collection.handle,
      title: response.collection.title,
    },
    products: response.collection.products.nodes.map((product) =>
      normalizeProduct(product, {variantMode: 'preview'}),
    ),
    pageInfo: response.collection.products.pageInfo,
  };
}

export async function getProductVariantMatrix(handle: string) {
  // Once a shopper asks for more options, fetch full matrix for just this product.
  const allVariants: VariantNode[] = [];
  let productSnapshot: ProductVariantsPageResponse['product'] = null;
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const page: ProductVariantsPageResponse =
      await mockShopFetch<ProductVariantsPageResponse>(
      PRODUCT_VARIANTS_QUERY,
      {
        after,
        first: FULL_VARIANT_PAGE_SIZE,
        handle,
      },
      );

    if (!page.product) {
      throw new Response(`Product ${handle} not found`, {status: 404});
    }

    productSnapshot = page.product;
    allVariants.push(...page.product.variants.nodes);
    hasNextPage = page.product.variants.pageInfo.hasNextPage;
    after = page.product.variants.pageInfo.endCursor;
  }

  return normalizeProduct(
    {
      ...productSnapshot!,
      variants: {
        nodes: allVariants,
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
    {variantMode: 'full'},
  );
}
