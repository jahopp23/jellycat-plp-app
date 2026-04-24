import {useState} from 'react';
import {Badge} from '~/components/ui/badge';
import {Button} from '~/components/ui/button';
import {useAnnouncementTimeout} from '~/hooks/useAnnouncementTimeout';
import {useLocalAssessmentBag} from '~/hooks/useLocalAssessmentBag';
import {useMenPlpCollection} from '~/hooks/useMenPlpCollection';
import {formatVariantOptions} from '~/lib/men-plp/plp-card-helpers';
import type {PlpProduct, PlpVariant} from '~/lib/men-plp';
import {AssessmentBag} from './AssessmentBag';
import {
  ABOVE_THE_FOLD_PRODUCT_COUNT,
  HIGH_PRIORITY_PRODUCT_COUNT,
} from './constants';
import {ProductCard} from './ProductCard';
import {ProductCardSkeleton} from './ProductCardSkeleton';
import type {MenCollectionPlpProps} from './types';

export function MenCollectionPlp({
  collectionTitle,
  deferredPageInfoPromise,
  deferredProductsPromise,
  pageInfo,
  products,
}: MenCollectionPlpProps) {
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const {bagItems, setBagItems, bagOpen, setBagOpen} = useLocalAssessmentBag();
  useAnnouncementTimeout(announcement, setAnnouncement);
  const {
    isPageLoading,
    isDeferredLoading,
    visibleProducts,
    visiblePageInfo,
    loadNextPage,
  } = useMenPlpCollection({
    products,
    pageInfo,
    deferredProductsPromise,
    deferredPageInfoPromise,
  });

  const totalItems = bagItems.reduce((sum, item) => sum + item.quantity, 0);

  function handleAddToBag(product: PlpProduct, variant: PlpVariant) {
    const optionsLabel = formatVariantOptions(variant);
    const nextQuantity =
      (bagItems.find((item) => item.variantId === variant.id)?.quantity ?? 0) + 1;

    console.log('[PLP AddToBag]', {
      availability: product.productAvailability,
      product: {
        handle: product.handle,
        id: product.id,
        title: product.title,
      },
      quantity: nextQuantity,
      selectedVariant: {
        availableForSale: variant.availableForSale,
        id: variant.id,
        selectedOptions: variant.selectedOptions,
        title: variant.title,
      },
      variants: product.previewVariants.map((previewVariant) => ({
        availableForSale: previewVariant.availableForSale,
        id: previewVariant.id,
        selectedOptions: previewVariant.selectedOptions,
        title: previewVariant.title,
      })),
    });

    setBagItems((currentItems) => {
      const currentItem = currentItems.find(
        (item) => item.variantId === variant.id,
      );

      if (!currentItem) {
        return [
          {
            imageUrl: variant.image?.url ?? product.image?.url ?? null,
            optionsLabel,
            price: variant.price,
            productHandle: product.handle,
            productTitle: product.title,
            quantity: 1,
            variantId: variant.id,
            variantTitle: variant.title,
          },
          ...currentItems,
        ];
      }

      return currentItems.map((item) =>
        item.variantId === variant.id
          ? {...item, quantity: item.quantity + 1}
          : item,
      );
    });

    setBagOpen(true);
    setAnnouncement(
      `${product.title}${
        optionsLabel ? ` • ${optionsLabel}` : ''
      } added to bag.`,
    );
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-4 md:px-6 xl:px-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-neutral-500">
            Jellycat Technical Assessment
          </p>
          <h1 className="mb-2">{collectionTitle}</h1>
          <p className="text-sm text-neutral-600">
            Product-based listing with bounded variant preview, deferred
            expansion per card, and quick add from the PLP.
          </p>
        </div>
        <Button onClick={() => setBagOpen((open) => !open)} variant="outline">
          Bag
          <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
            {totalItems}
          </span>
        </Button>
      </div>

      {announcement ? (
        <div className="mb-4" aria-live="polite">
          <Badge
            className="bg-neutral-100 text-neutral-700"
            variant="secondary"
          >
            {announcement}
          </Badge>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleProducts.map((product, index) => (
          <ProductCard
            isAboveTheFold={index < ABOVE_THE_FOLD_PRODUCT_COUNT}
            isLcpCandidate={index < HIGH_PRIORITY_PRODUCT_COUNT}
            isExpanded={expandedProductId === product.id}
            key={product.id}
            onAddToBag={handleAddToBag}
            onExpand={() => setExpandedProductId(product.id)}
            product={product}
          />
        ))}
        {isDeferredLoading || isPageLoading
          ? Array.from({length: isDeferredLoading ? 4 : 8}, (_, index) => (
              <ProductCardSkeleton key={`product-skeleton-${index}`} />
            ))
          : null}
      </div>

      {visiblePageInfo.hasNextPage &&
      visiblePageInfo.endCursor &&
      !isDeferredLoading ? (
        <div className="mt-2 flex justify-center">
          <Button
            className="min-w-[14rem] rounded-full px-6"
            disabled={isPageLoading || isDeferredLoading}
            onClick={loadNextPage}
            type="button"
            variant="default"
          >
            {isPageLoading
              ? 'Loading more products...'
              : 'Load More Products'}
          </Button>
        </div>
      ) : null}

      <AssessmentBag
        isOpen={bagOpen}
        items={bagItems}
        onClose={() => setBagOpen(false)}
      />
    </section>
  );
}
