import {Link} from '@remix-run/react';
import {Badge} from '~/components/ui/badge';
import {Button} from '~/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '~/components/ui/card';
import {usePlProductCard} from '~/hooks/usePlProductCard';
import {DROP_LIVE} from '~/lib/drop-config';
import {formatMoney, type PlpProduct, type PlpVariant} from '~/lib/men-plp';
import {formatVariantOptions, getAvailabilityBadgeClass} from '~/lib/men-plp/plp-card-helpers';
import {OptionGroupSelector} from './OptionGroupSelector';

type ProductCardProps = {
  isAboveTheFold: boolean;
  isLcpCandidate: boolean;
  isExpanded: boolean;
  product: PlpProduct;
  onAddToBag: (product: PlpProduct, variant: PlpVariant) => void;
  onExpand: () => void;
};

export function ProductCard({
  isAboveTheFold,
  isLcpCandidate,
  isExpanded,
  product,
  onAddToBag,
  onExpand,
}: ProductCardProps) {
  const {
    loadedProduct,
    product: productFromHook,
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
    currentVariants,
    selectedVariant,
    handleSelectOption,
    handleViewMoreOptions,
    handleQuickAdd,
  } = usePlProductCard({product, isExpanded, onAddToBag, onExpand});

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/4.1] overflow-hidden border-b border-neutral-200 bg-neutral-50">
        <Link
          aria-label={`View ${loadedProduct.title}`}
          className="block h-full w-full"
          prefetch="intent"
          to={`/products/${loadedProduct.handle}`}
        >
          {productImage ? (
            <img
              alt={productImage.altText ?? loadedProduct.title}
              className="h-full w-full object-cover"
              decoding={isAboveTheFold ? 'sync' : 'async'}
              height={productImage.height ?? 640}
              loading={isAboveTheFold ? 'eager' : 'lazy'}
              src={productImageUrl ?? productImage.url}
              width={productImage.width ?? 640}
              {...(isLcpCandidate
                ? ({fetchpriority: 'high'} as Record<string, string>)
                : {})}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              No image available
            </div>
          )}
        </Link>

        <div className="absolute left-3 top-3">
          <Badge className={getAvailabilityBadgeClass(displayAvailability)}>
            {availabilityLabel}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>
              <Link
                className="hover:underline"
                prefetch="intent"
                to={`/products/${loadedProduct.handle}`}
              >
                {loadedProduct.title}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1">
              {showFromPrice ? 'From ' : ''}
              {formatMoney(productPrice) ?? 'Price unavailable'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        {optionGroupsToRender.length ? (
          optionGroupsToRender.map((group) => (
            <OptionGroupSelector
              key={group.key}
              controlsDisabled={controlsDisabled}
              currentSelection={selection}
              group={group}
              isOptimisticallyLoading={isOptimisticallyExpanding}
              onSelect={handleSelectOption}
              optionGroups={productFromHook.optionGroups}
              variants={currentVariants}
            />
          ))
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Variant
            </p>
            <p className="text-sm text-neutral-600">Single option product</p>
          </div>
        )}

        {productFromHook.hasMoreVariants && !showExpandedSelector ? (
          <Button
            className="px-0"
            onClick={handleViewMoreOptions}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isLoadingMoreOptions
              ? 'Loading more options...'
              : expansionError
                ? 'Retry loading options'
                : 'View more options'}
          </Button>
        ) : null}

        {expansionError ? (
          <p className="text-sm text-neutral-600">
            {expansionError} Showing preview options only.
          </p>
        ) : null}

        {errorMessage ? (
          <Badge className="bg-red-600 text-white" variant="secondary">
            {errorMessage}
          </Badge>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-1.5 pt-1">
        <Button
          disabled={!canAddToBag || isValidatingAdd}
          onClick={handleQuickAdd}
          type="button"
        >
          {isValidatingAdd ? (
            <span
              aria-label="Loading"
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
              role="status"
            />
          ) : !DROP_LIVE || loadedProduct.productAvailability === 'coming_soon' ? (
            'Coming soon'
          ) : canAddToBag ? (
            'Add to cart'
          ) : (
            'Sold out'
          )}
        </Button>
        <p className="text-xs text-neutral-500">
          {selectedVariant
            ? `Selected: ${
                formatVariantOptions(selectedVariant) || selectedVariant.title
              }`
            : 'No available variant selected'}
        </p>
        <p className="text-xs text-neutral-500">Availability confirmed at checkout.</p>
      </CardFooter>
    </Card>
  );
}
