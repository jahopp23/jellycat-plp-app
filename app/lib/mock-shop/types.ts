import type {
  PlpImage,
  PlpMoney,
  PlpOptionGroup,
  PlpProduct,
  PlpSelectedOption,
  PlpVariant,
} from '~/lib/men-plp';

export type MoneyNode = {
  amount: string;
  currencyCode: string;
} | null;

export type ImageNode = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
} | null;

export type SelectedOptionNode = {
  name: string;
  value: string;
};

export type ProductOptionNode = {
  name: string;
  values: string[];
};

export type VariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: SelectedOptionNode[];
  price: MoneyNode;
  image: ImageNode;
};

export type ProductNode = {
  id: string;
  title: string;
  handle: string;
  availableForSale: boolean;
  featuredImage: ImageNode;
  priceRange: {
    minVariantPrice: MoneyNode;
    maxVariantPrice: MoneyNode;
  } | null;
  options: ProductOptionNode[];
  variants: {
    nodes: VariantNode[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor?: string | null;
    };
  };
};

export type GraphQlResponse<TData> = {
  data?: TData;
  errors?: Array<{message: string}>;
};

export type MenCollectionProductsResponse = {
  collection: {
    id: string;
    handle: string;
    title: string;
    products: {
      nodes: ProductNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type ProductVariantsPageResponse = {
  product: {
    id: string;
    handle: string;
    title: string;
    availableForSale: boolean;
    featuredImage: ImageNode;
    priceRange: {
      minVariantPrice: MoneyNode;
      maxVariantPrice: MoneyNode;
    } | null;
    options: ProductOptionNode[];
    variants: {
      nodes: VariantNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type MenCollectionResult = {
  collection: {
    id: string;
    handle: string;
    title: string;
  };
  products: PlpProduct[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type NormalizeProductArgs = {
  variantMode: 'preview' | 'full';
};

export type PreviewVariantSelectionArgs = {
  handle: string;
  optionGroups: PlpOptionGroup[];
  variants: PlpVariant[];
};

export type FindPreviewVariantArgs = {
  color?: string;
  size?: string;
};

export type DeriveAvailabilityArgs = {
  productAvailableForSale: boolean;
  variants: PlpVariant[];
};

export type OptionValueTestArgs = {
  variant: PlpVariant;
  optionKey: string;
  expectedValue: string;
};

export type IsDefaultTitleOptionArgs = ProductOptionNode;
export type IsDefaultTitleValueArgs = PlpSelectedOption;
export type NormalizedMoney = PlpMoney | null;
export type NormalizedImage = PlpImage | null;
