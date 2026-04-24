import type {PlpProduct} from '~/lib/men-plp';

export type MenCollectionPlpProps = {
  collectionTitle: string;
  deferredPageInfoPromise?: Promise<{
    hasNextPage: boolean;
    endCursor: string | null;
  }>;
  deferredProductsPromise?: Promise<PlpProduct[]>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  products: PlpProduct[];
};

export type {
  BagItem,
  ProductsPageData,
  VariantsFetcherData,
} from '~/lib/men-plp/plp-api-types';
