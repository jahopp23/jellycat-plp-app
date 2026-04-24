import {
  getOptionKey,
  getOptionKind,
  getOptionLabel,
  type PlpAvailability,
  type PlpProduct,
  type PlpSelectedOption,
  type PlpVariant,
} from '~/lib/men-plp';
import {DROP_LIVE, PRELAUNCH_DEMO_PRODUCT_HANDLE} from '~/lib/drop-config';
import {
  DEMO_FULLY_SOLD_OUT_HANDLE,
  DEMO_LOW_INVENTORY_HANDLE,
  DEMO_MIXED_AVAILABILITY_HANDLE,
  DEMO_SINGLE_VARIANT_HANDLE,
  DEMO_SOLD_OUT_COLOR_HANDLE,
  PREVIEW_COLOR_LIMIT,
  PREVIEW_SIZE_LIMIT,
  PREVIEW_VARIANT_MODEL_LIMIT,
} from './constants';
import type {
  DeriveAvailabilityArgs,
  FindPreviewVariantArgs,
  ImageNode,
  IsDefaultTitleOptionArgs,
  IsDefaultTitleValueArgs,
  MoneyNode,
  NormalizeProductArgs,
  OptionValueTestArgs,
  PreviewVariantSelectionArgs,
  ProductNode,
  ProductOptionNode,
  VariantNode,
} from './types';

export function normalizeProduct(
  product: ProductNode,
  {variantMode}: NormalizeProductArgs,
): PlpProduct {
  const optionGroups = normalizeOptionGroups(product.options);
  const normalizedVariants = product.variants.nodes.map((variant) =>
    normalizeVariant(variant),
  );
  const previewVariants =
    variantMode === 'preview'
      ? selectPreviewVariants({
          handle: product.handle,
          optionGroups,
          variants: normalizedVariants,
        })
      : normalizedVariants;

  return applyDemoInventoryOverrides({
    id: product.id,
    title: product.title,
    handle: product.handle,
    image: normalizeImage(product.featuredImage) ?? previewVariants[0]?.image ?? null,
    priceRange: {
      min: normalizeMoney(product.priceRange?.minVariantPrice ?? null),
      max: normalizeMoney(product.priceRange?.maxVariantPrice ?? null),
    },
    optionGroups,
    previewVariants,
    hasMoreVariants:
      variantMode === 'preview'
        ? product.variants.pageInfo.hasNextPage ||
          normalizedVariants.length > previewVariants.length
        : false,
    productAvailability: deriveAvailability({
      productAvailableForSale: product.availableForSale,
      variants: previewVariants,
    }),
    initialSelectedVariantId:
      previewVariants.find((variant) => variant.availableForSale)?.id ?? null,
  });
}

function selectPreviewVariants({
  handle,
  optionGroups,
  variants,
}: PreviewVariantSelectionArgs) {
  if (variants.length <= PREVIEW_VARIANT_MODEL_LIMIT) {
    return variants;
  }

  const colorGroup = optionGroups.find((group) => group.kind === 'color');
  const sizeGroup = optionGroups.find((group) => group.kind === 'size');
  const previewVariants: PlpVariant[] = [];

  if (sizeGroup) {
    const preferredPrimaryColor = getPreferredPreviewColors(handle, variants)[0];

    for (const sizeValue of getPreviewSizeValues(sizeGroup.values)) {
      const matchingVariant = findPreviewVariant(variants, {
        color: preferredPrimaryColor,
        size: sizeValue,
      });

      if (matchingVariant) {
        pushUniqueVariant(previewVariants, matchingVariant);
      }
    }
  }

  if (colorGroup) {
    for (const colorValue of getPreferredPreviewColors(handle, variants)) {
      const matchingVariant = findPreviewVariant(variants, {
        color: colorValue,
      });

      if (matchingVariant) {
        pushUniqueVariant(previewVariants, matchingVariant);
      }
    }
  }

  for (const variant of variants) {
    pushUniqueVariant(previewVariants, variant);

    if (previewVariants.length >= PREVIEW_VARIANT_MODEL_LIMIT) {
      break;
    }
  }

  return previewVariants.slice(0, PREVIEW_VARIANT_MODEL_LIMIT);
}

function normalizeOptionGroups(options: ProductOptionNode[]) {
  return options
    .filter((option) => !isDefaultTitleOption(option))
    .map((option) => ({
      key: getOptionKey(option.name),
      name: option.name,
      label: getOptionLabel(option.name),
      kind: getOptionKind(option.name),
      values: option.values,
    }));
}

function normalizeVariant(variant: VariantNode): PlpVariant {
  const selectedOptions = variant.selectedOptions
    .filter((option) => !isDefaultTitleValue(option))
    .map((option) => ({
      name: option.name,
      value: option.value,
    }));

  return {
    id: variant.id,
    title: variant.title,
    availableForSale: variant.availableForSale,
    price: normalizeMoney(variant.price),
    image: normalizeImage(variant.image),
    selectedOptions,
    optionValues: selectedOptions.reduce<Record<string, string>>((map, option) => {
      map[getOptionKey(option.name)] = option.value;
      return map;
    }, {}),
  };
}

function normalizeMoney(money: MoneyNode) {
  if (!money) return null;

  return {
    amount: money.amount,
    currencyCode: money.currencyCode,
  };
}

function normalizeImage(image: ImageNode) {
  if (!image) return null;

  return {
    url: image.url,
    altText: image.altText,
    width: image.width,
    height: image.height,
  };
}

function getPreferredPreviewColors(handle: string, variants: PlpVariant[]) {
  const colorValues = Array.from(
    new Set(
      variants
        .map((variant) => variant.optionValues.color)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (handle === DEMO_SOLD_OUT_COLOR_HANDLE && colorValues.includes('Purple')) {
    const remainingColors = colorValues.filter((value) => value !== 'Purple');
    return ['Purple', ...remainingColors].slice(0, PREVIEW_COLOR_LIMIT);
  }

  return colorValues.slice(0, PREVIEW_COLOR_LIMIT);
}

function getPreviewSizeValues(values: string[]) {
  const preferredLabels = ['small', 'medium', 'large'];
  const preferredValues = preferredLabels
    .map((label) => values.find((value) => normalizeSizeValue(value) === label))
    .filter((value): value is string => Boolean(value));
  const remainingValues = values.filter((value) => !preferredValues.includes(value));

  return [...preferredValues, ...remainingValues].slice(0, PREVIEW_SIZE_LIMIT);
}

function normalizeSizeValue(value: string) {
  const squashedValue = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (squashedValue === 'xs' || squashedValue === 'extrasmall') {
    return 'extra small';
  }
  if (squashedValue === 's' || squashedValue === 'small') {
    return 'small';
  }
  if (
    squashedValue === 'm' ||
    squashedValue === 'md' ||
    squashedValue === 'medium'
  ) {
    return 'medium';
  }
  if (squashedValue === 'l' || squashedValue === 'large') {
    return 'large';
  }
  if (squashedValue === 'xl' || squashedValue === 'extralarge') {
    return 'extra large';
  }
  if (
    squashedValue === 'xxl' ||
    squashedValue === '2xl' ||
    squashedValue === 'extraextralarge'
  ) {
    return 'extra extra large';
  }
  if (
    squashedValue === 'xxxl' ||
    squashedValue === '3xl' ||
    squashedValue === 'extraextraextralarge'
  ) {
    return 'extra extra extra large';
  }

  return value.trim().toLowerCase();
}

function findPreviewVariant(
  variants: PlpVariant[],
  {color, size}: FindPreviewVariantArgs,
) {
  return (
    variants.find(
      (variant) =>
        variant.availableForSale &&
        (!color || variant.optionValues.color === color) &&
        (!size ||
          normalizeSizeValue(variant.optionValues.size ?? '') ===
            normalizeSizeValue(size)),
    ) ??
    variants.find(
      (variant) =>
        (!color || variant.optionValues.color === color) &&
        (!size ||
          normalizeSizeValue(variant.optionValues.size ?? '') ===
            normalizeSizeValue(size)),
    ) ??
    null
  );
}

function pushUniqueVariant(collection: PlpVariant[], variant: PlpVariant) {
  if (collection.some((item) => item.id === variant.id)) return;
  collection.push(variant);
}

function deriveAvailability({
  productAvailableForSale,
  variants,
}: DeriveAvailabilityArgs): PlpAvailability {
  const hasAvailableVariant = variants.some((variant) => variant.availableForSale);

  if (!productAvailableForSale || (!hasAvailableVariant && variants.length > 0)) {
    return 'sold_out';
  }

  return 'available';
}

function applyDemoInventoryOverrides(product: PlpProduct): PlpProduct {
  if (!DROP_LIVE || product.handle === PRELAUNCH_DEMO_PRODUCT_HANDLE) {
    return {
      ...product,
      productAvailability: 'coming_soon',
      previewVariants: product.previewVariants.map((variant) => ({
        ...variant,
        availableForSale: false,
      })),
      initialSelectedVariantId: null,
    };
  }

  if (product.handle === DEMO_SINGLE_VARIANT_HANDLE) {
    const singleVariant =
      product.previewVariants.find((variant) => variant.availableForSale) ??
      product.previewVariants[0] ??
      null;

    if (!singleVariant) {
      return {
        ...product,
        productAvailability: 'sold_out',
        hasMoreVariants: false,
        initialSelectedVariantId: null,
        optionGroups: [],
        previewVariants: [],
      };
    }

    return {
      ...product,
      productAvailability: singleVariant.availableForSale ? 'available' : 'sold_out',
      hasMoreVariants: false,
      initialSelectedVariantId: singleVariant.availableForSale
        ? singleVariant.id
        : null,
      optionGroups: [],
      previewVariants: [singleVariant],
    };
  }

  const previewVariants = product.previewVariants.map((variant) => {
    if (product.handle === DEMO_FULLY_SOLD_OUT_HANDLE) {
      return {...variant, availableForSale: false};
    }

    if (
      product.handle === DEMO_SOLD_OUT_COLOR_HANDLE &&
      hasOptionValue({variant, optionKey: 'color', expectedValue: 'Purple'})
    ) {
      return {...variant, availableForSale: false};
    }

    if (
      product.handle === DEMO_MIXED_AVAILABILITY_HANDLE &&
      hasOptionValue({variant, optionKey: 'size', expectedValue: '9'})
    ) {
      return {...variant, availableForSale: false};
    }

    return variant;
  });

  const hasAvailableVariant = previewVariants.some(
    (variant) => variant.availableForSale,
  );

  let productAvailability = deriveAvailability({
    productAvailableForSale: hasAvailableVariant,
    variants: previewVariants,
  });

  if (
    product.handle === DEMO_LOW_INVENTORY_HANDLE &&
    productAvailability !== 'sold_out'
  ) {
    productAvailability = 'low';
  }

  return {
    ...product,
    previewVariants,
    productAvailability,
    initialSelectedVariantId:
      previewVariants.find((variant) => variant.availableForSale)?.id ?? null,
  };
}

function hasOptionValue({
  variant,
  optionKey,
  expectedValue,
}: OptionValueTestArgs) {
  return variant.optionValues[optionKey] === expectedValue;
}

function isDefaultTitleOption(option: IsDefaultTitleOptionArgs) {
  return (
    option.name === 'Title' &&
    option.values.length === 1 &&
    option.values[0] === 'Default Title'
  );
}

function isDefaultTitleValue(option: IsDefaultTitleValueArgs) {
  return option.name === 'Title' && option.value === 'Default Title';
}
