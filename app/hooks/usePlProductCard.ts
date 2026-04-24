import {useFetcher} from '@remix-run/react';
import {useEffect, useMemo, useState} from 'react';
import {
  DROP_LIVE,
  DROP_RACE_CONDITION_ENABLED,
  DROP_RACE_DELAY_MS,
} from '~/lib/drop-config';
import {
  getAvailabilityLabel,
  getProductCardImageUrl,
  type PlpOptionGroup,
  type PlpProduct,
  type PlpVariant,
} from '~/lib/men-plp';
import {
  areSelectionsEqual,
  delay,
  fetchLatestVariantAvailability,
  findFirstAvailableVariant,
  getDefaultVariant,
  getDisplayAvailability,
  getDisplayOptionGroups,
  getSelectionFromVariant,
  readSoldOutVariantIds,
  resolveSelectedVariant,
  shouldInvalidateSelectedVariant,
  writeSoldOutVariantIds,
} from '~/lib/men-plp/plp-card-helpers';
import type {VariantsFetcherData} from '~/lib/men-plp/plp-api-types';

export function usePlProductCard({
  product,
  isExpanded,
  onAddToBag,
  onExpand,
}: {
  product: PlpProduct;
  isExpanded: boolean;
  onAddToBag: (product: PlpProduct, variant: PlpVariant) => void;
  onExpand: () => void;
}) {
  const variantsFetcher = useFetcher<VariantsFetcherData>();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isValidatingAdd, setIsValidatingAdd] = useState(false);
  const [soldOutVariantIds, setSoldOutVariantIds] = useState<string[]>([]);

  const fullProduct = variantsFetcher.data?.product ?? null;
  const expansionError = variantsFetcher.data?.error ?? null;
  const loadedProduct = fullProduct ?? product;
  const previewOptionGroups = useMemo(
    () =>
      getDisplayOptionGroups({
        isExpanded: false,
        optionGroups: product.optionGroups,
        variants: product.previewVariants,
      }),
    [product.optionGroups, product.previewVariants],
  );
  const currentVariants = useMemo(
    () =>
      loadedProduct.previewVariants.map((variant) =>
        soldOutVariantIds.includes(variant.id)
          ? {...variant, availableForSale: false}
          : variant,
      ),
    [loadedProduct.previewVariants, soldOutVariantIds],
  );

  useEffect(() => {
    setSoldOutVariantIds(readSoldOutVariantIds(loadedProduct.id));
  }, [loadedProduct.id]);
  const selectedVariant = useMemo(
    () =>
      resolveSelectedVariant({
        initialSelectedVariantId: loadedProduct.initialSelectedVariantId,
        optionGroups: loadedProduct.optionGroups,
        selection,
        variants: currentVariants,
      }),
    [
      currentVariants,
      loadedProduct.initialSelectedVariantId,
      loadedProduct.optionGroups,
      selection,
    ],
  );

  useEffect(() => {
    const nextVariant = selectedVariant ?? getDefaultVariant(currentVariants);
    if (!nextVariant) return;
    const nextSelection = getSelectionFromVariant(nextVariant);
    if (!areSelectionsEqual(selection, nextSelection)) {
      setSelection(nextSelection);
    }
  }, [currentVariants, selectedVariant, selection]);

  useEffect(() => {
    if (!selectedVariant || selectedVariant.availableForSale) return;

    const nextAvailableVariant =
      findFirstAvailableVariant(
        currentVariants,
        loadedProduct.optionGroups,
        selection,
      ) ?? getDefaultVariant(currentVariants);

    if (nextAvailableVariant?.availableForSale) {
      setSelection(getSelectionFromVariant(nextAvailableVariant));
      setErrorMessage('This option is no longer available.');
    }
  }, [currentVariants, loadedProduct.optionGroups, selectedVariant, selection]);

  const productImage = selectedVariant?.image ?? loadedProduct.image;
  const productPrice = selectedVariant?.price ?? loadedProduct.priceRange.min;
  const showFromPrice =
    loadedProduct.priceRange.min &&
    loadedProduct.priceRange.max &&
    loadedProduct.priceRange.min.amount !== loadedProduct.priceRange.max.amount;
  const canAddToBag = Boolean(DROP_LIVE && selectedVariant?.availableForSale);
  const controlsDisabled =
    !DROP_LIVE ||
    loadedProduct.productAvailability === 'sold_out' ||
    loadedProduct.productAvailability === 'coming_soon';
  const isLoadingMoreOptions = variantsFetcher.state !== 'idle';
  const showExpandedSelector = isExpanded;
  const isOptimisticallyExpanding =
    isExpanded && !fullProduct && !expansionError;
  const optionGroupsToRender = useMemo(
    () =>
      showExpandedSelector
        ? getDisplayOptionGroups({
            isExpanded: !expansionError,
            optionGroups: product.optionGroups,
            variants: currentVariants,
          })
        : previewOptionGroups,
    [
      currentVariants,
      expansionError,
      product.optionGroups,
      previewOptionGroups,
      showExpandedSelector,
    ],
  );
  const displayAvailability = getDisplayAvailability({
    productAvailability: loadedProduct.productAvailability,
    currentSelection: selection,
    optionGroups: optionGroupsToRender,
    variants: currentVariants,
  });
  const availabilityLabel = getAvailabilityLabel(displayAvailability);
  const productImageUrl = getProductCardImageUrl(productImage);

  function handleSelectOption(group: PlpOptionGroup, value: string) {
    if (controlsDisabled) return;
    const nextSelection = {...selection, [group.key]: value};
    const nextVariant = findFirstAvailableVariant(
      currentVariants,
      loadedProduct.optionGroups,
      nextSelection,
    );
    if (!nextVariant) {
      setErrorMessage('This option is no longer available.');
      return;
    }
    setErrorMessage(null);
    setSelection(getSelectionFromVariant(nextVariant));
  }

  function handleViewMoreOptions() {
    onExpand();
    setErrorMessage(null);
    if (!fullProduct && variantsFetcher.state === 'idle') {
      variantsFetcher.load(`/api/products/${product.handle}/variants`);
    }
  }

  async function handleQuickAdd() {
    if (isValidatingAdd) return;
    const selectedVariantAvailable = selectedVariant?.availableForSale ?? false;
    if (!selectedVariantAvailable || !selectedVariant) {
      setErrorMessage('This product just sold out.');
      return;
    }
    setIsValidatingAdd(true);
    await delay(DROP_RACE_DELAY_MS);
    const latestVariant = await fetchLatestVariantAvailability({
      handle: loadedProduct.handle,
      variantId: selectedVariant.id,
    });
    const latestVariantAvailable = latestVariant?.availableForSale ?? false;
    if (!latestVariantAvailable) {
      setSoldOutVariantIds((current) => {
        const next = current.includes(selectedVariant.id)
          ? current
          : [...current, selectedVariant.id];
        writeSoldOutVariantIds(loadedProduct.id, next);
        return next;
      });
      setIsValidatingAdd(false);
      setErrorMessage('This product just sold out.');
      return;
    }
    if (
      DROP_RACE_CONDITION_ENABLED &&
      shouldInvalidateSelectedVariant({
        productId: loadedProduct.id,
        productHandle: loadedProduct.handle,
        selectedVariantId: selectedVariant.id,
        variants: currentVariants,
      })
    ) {
      setSoldOutVariantIds((current) => {
        const next = current.includes(selectedVariant.id)
          ? current
          : [...current, selectedVariant.id];
        writeSoldOutVariantIds(loadedProduct.id, next);
        return next;
      });
      setIsValidatingAdd(false);
      setErrorMessage('This product just sold out.');
      return;
    }
    setErrorMessage(null);
    onAddToBag(loadedProduct, selectedVariant);
    setIsValidatingAdd(false);
  }

  return {
    loadedProduct,
    product,
    productImage,
    productPrice,
    showFromPrice,
    canAddToBag,
    controlsDisabled,
    isLoadingMoreOptions,
    showExpandedSelector,
    isOptimisticallyExpanding,
    optionGroupsToRender,
    displayAvailability,
    availabilityLabel,
    productImageUrl,
    selection,
    errorMessage,
    isValidatingAdd,
    expansionError,
    fullProduct,
    currentVariants,
    selectedVariant,
    handleSelectOption,
    handleViewMoreOptions,
    handleQuickAdd,
  };
}
