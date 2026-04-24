export type PlpMoney = {
  amount: string;
  currencyCode: string;
};

export type PlpImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type PlpSelectedOption = {
  name: string;
  value: string;
};

export type PlpOptionKind = 'color' | 'size' | 'other';

export type PlpOptionGroup = {
  key: string;
  name: string;
  label: string;
  kind: PlpOptionKind;
  values: string[];
};

export type PlpVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: PlpMoney | null;
  image: PlpImage | null;
  selectedOptions: PlpSelectedOption[];
  optionValues: Record<string, string>;
};

export type PlpAvailability =
  | 'available'
  | 'low'
  | 'sold_out'
  | 'coming_soon';

export type PlpProduct = {
  id: string;
  title: string;
  handle: string;
  image: PlpImage | null;
  priceRange: {
    min: PlpMoney | null;
    max: PlpMoney | null;
  };
  optionGroups: PlpOptionGroup[];
  previewVariants: PlpVariant[];
  hasMoreVariants: boolean;
  productAvailability: PlpAvailability;
  initialSelectedVariantId: string | null;
};

const PRODUCT_CARD_IMAGE_WIDTH = 720;

// mock.shop exposes Shopify-style option names, but the PLP wants a stable
// client contract. These aliases let the UI treat Colour/Colors the same way.
const COLOR_OPTION_NAMES = new Set(['color', 'colour', 'colors']);
const SIZE_OPTION_NAMES = new Set(['size', 'sizes']);

export function getOptionKey(name: string) {
  const normalizedName = name.trim().toLowerCase();

  if (COLOR_OPTION_NAMES.has(normalizedName)) return 'color';
  if (SIZE_OPTION_NAMES.has(normalizedName)) return 'size';

  return normalizedName;
}

export function getOptionKind(name: string): PlpOptionKind {
  const optionKey = getOptionKey(name);

  if (optionKey === 'color') return 'color';
  if (optionKey === 'size') return 'size';

  return 'other';
}

export function getOptionLabel(name: string) {
  const optionKind = getOptionKind(name);

  if (optionKind === 'color') return 'Color';
  if (optionKind === 'size') return 'Size';

  return name;
}

export function getAvailabilityLabel(availability: PlpAvailability) {
  if (availability === 'sold_out') return 'Sold out';
  if (availability === 'low') return 'Low inventory';
  if (availability === 'coming_soon') return 'Coming soon';

  return 'Available';
}

export function formatMoney(money: PlpMoney | null | undefined) {
  if (!money) return null;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(money.amount));
}

export function getVariantValue(variant: PlpVariant, optionKey: string) {
  return variant.optionValues[optionKey] ?? null;
}

export function getProductCardImageUrl(
  image: Pick<PlpImage, 'url'> | null | undefined,
) {
  if (!image?.url) return null;

  try {
    const optimizedUrl = new URL(image.url);
    optimizedUrl.searchParams.set('width', String(PRODUCT_CARD_IMAGE_WIDTH));
    return optimizedUrl.toString();
  } catch {
    const separator = image.url.includes('?') ? '&' : '?';
    return `${image.url}${separator}width=${PRODUCT_CARD_IMAGE_WIDTH}`;
  }
}
