import {useEffect, useMemo, useState} from 'react';
import type {
  CartApiQueryFragment,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Header} from '~/components/Header';
import {
  PredictiveSearchForm,
  PredictiveSearchResults,
} from '~/components/Search';

export type LayoutProps = {
  cart: Promise<CartApiQueryFragment | null>;
  children?: React.ReactNode;
  header: HeaderQuery;
  isLoggedIn: boolean;
};

export function Layout({
  cart,
  children = null,
  header,
  isLoggedIn,
}: LayoutProps) {
  return (
    <>
      <CartAside />
      <SearchAside />
      <Header header={header} cart={cart} isLoggedIn={isLoggedIn} />
      <main>{children}</main>
    </>
  );
}

function CartAside() {
  const [items, setItems] = useState<LocalBagItem[]>([]);

  useEffect(() => {
    function syncItems() {
      try {
        const raw = window.localStorage.getItem('jellycat-men-plp-bag');
        setItems(raw ? (JSON.parse(raw) as LocalBagItem[]) : []);
      } catch {
        setItems([]);
      }
    }

    syncItems();
    window.addEventListener('storage', syncItems);
    window.addEventListener('jellycat-bag-updated', syncItems);
    return () => {
      window.removeEventListener('storage', syncItems);
      window.removeEventListener('jellycat-bag-updated', syncItems);
    };
  }, []);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.price?.amount ?? 0) * item.quantity,
        0,
      ),
    [items],
  );

  function writeItems(nextItems: LocalBagItem[]) {
    window.localStorage.setItem('jellycat-men-plp-bag', JSON.stringify(nextItems));
    setItems(nextItems);
    window.dispatchEvent(new Event('jellycat-bag-updated'));
  }

  function updateItemQuantity(variantId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      writeItems(items.filter((item) => item.variantId !== variantId));
      return;
    }

    writeItems(
      items.map((item) =>
        item.variantId === variantId ? {...item, quantity: nextQuantity} : item,
      ),
    );
  }

  return (
    <Aside id="cart-aside" heading="CART">
      {items.length ? (
        <div className="space-y-4">
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                className="grid grid-cols-[64px_minmax(0,1fr)] gap-3"
                key={item.variantId}
              >
                {item.imageUrl ? (
                  <img
                    alt={item.productTitle}
                    className="h-16 w-16 rounded-md object-cover"
                    loading="lazy"
                    src={item.imageUrl}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-neutral-100" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.productTitle}</p>
                  <p className="text-xs text-neutral-600">
                    {item.optionsLabel || item.variantTitle}
                  </p>
                  <p className="text-xs text-neutral-600">
                    Qty {item.quantity} {' · '}
                    {formatLocalMoney(item.price) ?? 'Price unavailable'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded border px-2 py-0.5 text-xs"
                      onClick={() =>
                        updateItemQuantity(item.variantId, item.quantity - 1)
                      }
                      type="button"
                    >
                      -
                    </button>
                    <button
                      className="rounded border px-2 py-0.5 text-xs"
                      onClick={() =>
                        updateItemQuantity(item.variantId, item.quantity + 1)
                      }
                      type="button"
                    >
                      +
                    </button>
                    <button
                      className="text-xs text-neutral-600 underline"
                      onClick={() => updateItemQuantity(item.variantId, 0)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
            <p className="text-sm text-neutral-600">Subtotal</p>
            <strong>
              {new Intl.NumberFormat('en-US', {
                currency: 'USD',
                style: 'currency',
              }).format(subtotal)}
            </strong>
          </div>
          <p className="text-xs text-neutral-500">Using local bag state.</p>
        </div>
      ) : (
        <p>Your cart is empty</p>
      )}
    </Aside>
  );
}

type LocalBagItem = {
  productTitle: string;
  variantId: string;
  variantTitle: string;
  price: {amount: string; currencyCode: string} | null;
  imageUrl: string | null;
  optionsLabel: string;
  quantity: number;
};

function formatLocalMoney(
  money: {amount: string; currencyCode: string} | null | undefined,
) {
  if (!money) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(money.amount));
}

function SearchAside() {
  return (
    <Aside id="search-aside" heading="SEARCH">
      <div className="predictive-search">
        <br />
        <PredictiveSearchForm>
          {({fetchResults, inputRef}) => (
            <div>
              <input
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
              />
              &nbsp;
              <button type="submit">Search</button>
            </div>
          )}
        </PredictiveSearchForm>
        <PredictiveSearchResults />
      </div>
    </Aside>
  );
}

