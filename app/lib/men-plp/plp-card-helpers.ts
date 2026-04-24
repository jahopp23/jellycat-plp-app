import {
  DROP_LIVE,
  FORCE_SELL_OUT_DEMO_ENABLED,
  FORCE_SELL_OUT_PRODUCT_HANDLE,
} from '~/lib/drop-config';
import {getOptionKey, getVariantValue, type PlpOptionGroup, type PlpProduct, type PlpVariant} from '~/lib/men-plp';
import {DROP_SOLD_OUT_STORAGE_KEY, PREVIEW_COLOR_COUNT, PREVIEW_SIZE_COUNT} from '~/lib/men-plp/plp-constants';

export function getDisplayOptionGroups({
  isExpanded,
  optionGroups,
  variants,
}: {
  isExpanded: boolean;
  optionGroups: PlpOptionGroup[];
  variants: PlpVariant[];
}) {
  return optionGroups
    .map((group) => ({
      ...group,
      values: getDisplayGroupValues({group, isExpanded, variants}),
    }))
    .filter((group) => group.values.length > 0);
}

export function getDisplayGroupValues({
  group,
  isExpanded,
  variants,
}: {
  group: PlpOptionGroup;
  isExpanded: boolean;
  variants: PlpVariant[];
}) {
  const colorValues = Array.from(
    new Set(
      variants
        .map((variant) => getVariantValue(variant, group.key))
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, PREVIEW_COLOR_COUNT);
  const filteredValues = group.values.filter((value) =>
    variants.some((variant) => getVariantValue(variant, group.key) === value),
  );

  return isExpanded
    ? group.values
    : group.kind === 'color'
    ? colorValues
    : group.kind === 'size'
    ? getPreviewSizeValues(group, variants)
    : filteredValues;
}

export function getPreviewSizeValues(
  group: PlpOptionGroup,
  variants: PlpVariant[],
) {
  const values = Array.from(
    new Set(
      variants
        .map((variant) => getVariantValue(variant, group.key))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const preferredLabels = ['small', 'medium', 'large'];
  const preferredValues = preferredLabels
    .map((label) => values.find((value) => normalizeSizeValue(value) === label))
    .filter((value): value is string => Boolean(value));
  const remainingValues = values.filter(
    (value) => !preferredValues.includes(value),
  );

  return [...preferredValues, ...remainingValues].slice(0, PREVIEW_SIZE_COUNT);
}

export function resolveSelectedVariant({
  initialSelectedVariantId,
  optionGroups,
  selection,
  variants,
}: {
  initialSelectedVariantId: string | null;
  optionGroups: PlpOptionGroup[];
  selection: Record<string, string>;
  variants: PlpVariant[];
}) {
  const exactAvailableMatch = variants.find(
    (variant) =>
      variant.availableForSale &&
      matchesSelection(variant, optionGroups, selection),
  );

  const exactUnavailableMatch = variants.find((variant) =>
    matchesSelection(variant, optionGroups, selection),
  );

  return (
    (variants.length
      ? exactAvailableMatch ??
        exactUnavailableMatch ??
        variants.find(
          (variant) =>
            variant.id === initialSelectedVariantId && variant.availableForSale,
        ) ??
        getDefaultVariant(variants)
      : null) ?? null
  );
}

export function findFirstAvailableVariant(
  variants: PlpVariant[],
  optionGroups: PlpOptionGroup[],
  selection: Record<string, string>,
) {
  return (
    variants.find(
      (variant) =>
        variant.availableForSale &&
        matchesSelection(variant, optionGroups, selection),
    ) ?? null
  );
}

export function getDefaultVariant(variants: PlpVariant[]) {
  return (
    variants.find((variant) => variant.availableForSale) ?? variants[0] ?? null
  );
}

export function getDisplayAvailability({
  productAvailability,
  currentSelection,
  optionGroups,
  variants,
}: {
  productAvailability: PlpProduct['productAvailability'];
  currentSelection: Record<string, string>;
  optionGroups: PlpOptionGroup[];
  variants: PlpVariant[];
}) {
  const isComingSoon = !DROP_LIVE || productAvailability === 'coming_soon';
  const hasAvailableVariant = variants.some((variant) => variant.availableForSale);
  const hasNoSellableVariants = !hasAvailableVariant && variants.length > 0;
  const isTerminalAvailability =
    productAvailability === 'sold_out' || productAvailability === 'low';

  const hasDisabledChoice = optionGroups.some((group) =>
    group.values.some((value) => {
      return currentSelection[group.key] === value
        ? false
        : !findFirstAvailableVariant(variants, optionGroups, {
            ...currentSelection,
            [group.key]: value,
          });
    }),
  );

  return isComingSoon
    ? 'coming_soon'
    : hasNoSellableVariants
    ? 'sold_out'
    : isTerminalAvailability
    ? productAvailability
    : hasDisabledChoice
    ? 'low'
    : 'available';
}

export function getSelectionFromVariant(variant: PlpVariant) {
  return variant.selectedOptions.reduce<Record<string, string>>(
    (map, option) => {
      map[getOptionKey(option.name)] = option.value;
      return map;
    },
    {},
  );
}

export function matchesSelection(
  variant: PlpVariant,
  optionGroups: PlpOptionGroup[],
  selection: Record<string, string>,
) {
  return optionGroups.every((group) => {
    const selectedValue = selection[group.key];
    return !selectedValue
      ? true
      : getVariantValue(variant, group.key) === selectedValue;
  });
}

export function areSelectionsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => left[key] === right[key]);
}

export function formatVariantOptions(variant: PlpVariant) {
  return variant.selectedOptions.map((option) => option.value).join(' / ');
}

export function getAvailabilityBadgeClass(
  availability: PlpProduct['productAvailability'],
) {
  const classByAvailability: Record<PlpProduct['productAvailability'], string> = {
    available: 'bg-green-600 text-white',
    low: 'bg-orange-500 text-white',
    sold_out: 'bg-red-600 text-white',
    coming_soon: 'bg-neutral-700 text-white',
  };
  return classByAvailability[availability] ?? 'bg-neutral-700 text-white';
}

export function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function shouldInvalidateSelectedVariant({
  productId,
  productHandle,
  selectedVariantId,
  variants,
}: {
  productId: string;
  productHandle: string;
  selectedVariantId: string;
  variants: PlpVariant[];
}) {
  if (variants.length <= 1) return false;
  if (
    FORCE_SELL_OUT_DEMO_ENABLED &&
    productHandle === FORCE_SELL_OUT_PRODUCT_HANDLE
  ) {
    return true;
  }

  const key = 'jellycat-drop-add-attempt';
  const nextAttempt = Number(window.sessionStorage.getItem(key) ?? '0') + 1;
  window.sessionStorage.setItem(key, String(nextAttempt));

  const seed = hashString(`${productId}:${nextAttempt}`);
  const index = Math.abs(seed) % variants.length;
  return variants[index]?.id === selectedVariantId;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function readSoldOutVariantIds(productId: string) {
  try {
    const raw = window.localStorage.getItem(DROP_SOLD_OUT_STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return state[productId] ?? [];
  } catch {
    return [];
  }
}

export function writeSoldOutVariantIds(productId: string, variantIds: string[]) {
  try {
    const raw = window.localStorage.getItem(DROP_SOLD_OUT_STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    state[productId] = variantIds;
    window.localStorage.setItem(
      DROP_SOLD_OUT_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // no-op in demo mode
  }
}

export async function fetchLatestVariantAvailability({
  handle,
  variantId,
}: {
  handle: string;
  variantId: string;
}) {
  try {
    const response = await fetch(`/api/products/${handle}/variants`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      product?: PlpProduct | null;
      error?: string;
    };
    return (
      data.product?.previewVariants.find((variant) => variant.id === variantId) ??
      null
    );
  } catch {
    return null;
  }
}

export function getOptionValueLabel(group: PlpOptionGroup, value: string) {
  const normalizedValue = normalizeSizeValue(value);
  const sizeLabelMap: Record<string, string> = {
    'extra small': 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    'extra large': 'XL',
    'extra extra large': '2XL',
    'extra extra extra large': '3XL',
  };
  return group.kind === 'size'
    ? (sizeLabelMap[normalizedValue] ?? value.toUpperCase())
    : value;
}

export function normalizeSizeValue(value: string) {
  const squashedValue = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const normalizedMap: Record<string, string> = {
    xs: 'extra small',
    extrasmall: 'extra small',
    s: 'small',
    small: 'small',
    m: 'medium',
    md: 'medium',
    medium: 'medium',
    l: 'large',
    large: 'large',
    xl: 'extra large',
    extralarge: 'extra large',
    xxl: 'extra extra large',
    '2xl': 'extra extra large',
    extraextralarge: 'extra extra large',
    xxxl: 'extra extra extra large',
    '3xl': 'extra extra extra large',
    extraextraextralarge: 'extra extra extra large',
  };

  return normalizedMap[squashedValue] ?? value.trim().toLowerCase();
}

export function getSwatchColor(value: string) {
  const swatches: Record<string, string> = {
    black: '#1a1a1a',
    blue: '#3a67d9',
    clay: '#c49a7b',
    green: '#4b8f57',
    grey: '#848a93',
    gray: '#848a93',
    ocean: '#1f7a8c',
    olive: '#758748',
    purple: '#8356b3',
    red: '#bf4040',
    white: '#f5f3ee',
  };

  return swatches[value.toLowerCase()] ?? '#d7d2ca';
}
