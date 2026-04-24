import {useCallback, useEffect, useState} from 'react';
import type {PlpProduct} from '~/lib/men-plp';
import type {ProductsPageData} from '~/lib/men-plp/plp-api-types';

type UseMenPlpCollectionArgs = {
  products: PlpProduct[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  deferredProductsPromise?: Promise<PlpProduct[]>;
  deferredPageInfoPromise?: Promise<{
    hasNextPage: boolean;
    endCursor: string | null;
  }>;
};

export function useMenPlpCollection({
  products,
  pageInfo,
  deferredProductsPromise,
  deferredPageInfoPromise,
}: UseMenPlpCollectionArgs) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isDeferredLoading, setIsDeferredLoading] = useState(
    Boolean(deferredProductsPromise),
  );
  const [visibleProducts, setVisibleProducts] = useState<PlpProduct[]>(products);
  const [visiblePageInfo, setVisiblePageInfo] = useState(pageInfo);

  useEffect(() => {
    setVisibleProducts(products);
    setVisiblePageInfo(pageInfo);
    setIsDeferredLoading(Boolean(deferredProductsPromise));
  }, [deferredProductsPromise, products, pageInfo]);

  useEffect(() => {
    let cancelled = false;

    deferredProductsPromise
      ?.then((nextProducts) => {
        if (!cancelled && nextProducts.length > 0) {
          setVisibleProducts((currentProducts) => {
            const knownIds = new Set(
              currentProducts.map((product) => product.id),
            );
            const uniqueNextProducts = nextProducts.filter(
              (product) => !knownIds.has(product.id),
            );
            return [...currentProducts, ...uniqueNextProducts];
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsDeferredLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deferredProductsPromise]);

  useEffect(() => {
    let cancelled = false;

    deferredPageInfoPromise?.then((nextPageInfo) => {
      if (!cancelled) setVisiblePageInfo(nextPageInfo);
    });

    return () => {
      cancelled = true;
    };
  }, [deferredPageInfoPromise]);

  const loadNextPage = useCallback(() => {
    if (!visiblePageInfo.hasNextPage || !visiblePageInfo.endCursor) return;
    if (isPageLoading) return;

    setIsPageLoading(true);
    fetch(
      `/api/products?after=${encodeURIComponent(
        visiblePageInfo.endCursor,
      )}&ts=${Date.now()}`,
      {cache: 'no-store'},
    )
      .then((response) => {
        return response.ok ? (response.json() as Promise<ProductsPageData>) : null;
      })
      .then((data) => {
        if (!data) return;

        setVisibleProducts((currentProducts) => {
          const knownIds = new Set(currentProducts.map((product) => product.id));
          const nextProducts = data.products.filter(
            (product) => !knownIds.has(product.id),
          );
          return [...currentProducts, ...nextProducts];
        });
        setVisiblePageInfo(data.pageInfo);
      })
      .finally(() => {
        setIsPageLoading(false);
      });
  }, [isPageLoading, visiblePageInfo.endCursor, visiblePageInfo.hasNextPage]);

  return {
    isPageLoading,
    isDeferredLoading,
    visibleProducts,
    visiblePageInfo,
    loadNextPage,
  };
}
