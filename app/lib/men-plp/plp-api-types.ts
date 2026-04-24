import type {PlpMoney, PlpProduct} from './men-plp';

export type VariantsFetcherData = {
  error?: string;
  product?: PlpProduct | null;
};

export type BagItem = {
  productHandle: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  price: PlpMoney | null;
  imageUrl: string | null;
  optionsLabel: string;
  quantity: number;
};

export type ProductsPageData = {
  collection: {
    id: string;
    handle: string;
    title: string;
  };
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  products: PlpProduct[];
};
