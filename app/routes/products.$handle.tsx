import type {V2_MetaFunction} from '@shopify/remix-oxygen';
import {json, type LoaderArgs} from '@shopify/remix-oxygen';
import {Link, useLoaderData} from '@remix-run/react';
import {useEffect, useState} from 'react';
import {getOptionKey, type PlpProduct, type PlpVariant} from '~/lib/men-plp';
import {
  DROP_LIVE,
  FORCE_SELL_OUT_DEMO_ENABLED,
  FORCE_SELL_OUT_PRODUCT_HANDLE,
  DROP_RACE_CONDITION_ENABLED,
  DROP_RACE_DELAY_MS,
} from '~/lib/drop-config';
import {getProductVariantMatrix} from '~/lib/mock-shop.server';

export const meta: V2_MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.product?.title ?? 'Product'}`}];
};

const BAG_STORAGE_KEY = 'jellycat-men-plp-bag';
const DROP_SOLD_OUT_STORAGE_KEY = 'jellycat-drop-sold-out-variants';

type BagItem = {
  productHandle: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  price: {amount: string; currencyCode: string} | null;
  imageUrl: string | null;
  optionsLabel: string;
  quantity: number;
};

type LatestVariantResponse = {
  product?: PlpProduct | null;
  error?: string;
};

export async function loader({params, request}: LoaderArgs) {
  const handle = params.handle;
  if (!handle) throw new Response('Missing product handle', {status: 400});

  let product: PlpProduct;
  try {
    product = await getProductVariantMatrix(handle);
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response('Not Found', {status: 404});
  }

  const url = new URL(request.url);
  const selectedOptions = parseSelectedOptions(url.searchParams);
  const selectedVariant =
    resolveSelectedVariant(product, selectedOptions) ??
    product.previewVariants.find((variant) => variant.availableForSale) ??
    product.previewVariants[0] ??
    null;

  return json({
    product,
    selectedOptions,
    selectedVariantId: selectedVariant?.id ?? null,
  });
}

export default function ProductRoute() {
  const {product, selectedOptions, selectedVariantId} =
    useLoaderData<typeof loader>();
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [soldOutVariantIds, setSoldOutVariantIds] = useState<string[]>([]);
  const uiVariants = product.previewVariants.map((variant) =>
    soldOutVariantIds.includes(variant.id)
      ? {...variant, availableForSale: false}
      : variant,
  );
  const [quantity, setQuantity] = useState(1);
  const selectedVariant =
    uiVariants.find((variant) => variant.id === selectedVariantId) ??
    null;
  const image = selectedVariant?.image ?? product.image;

  useEffect(() => {
    if (!announcement) return;
    const timeoutId = window.setTimeout(() => setAnnouncement(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [announcement]);

  useEffect(() => {
    setSoldOutVariantIds(readSoldOutVariantIds(product.id));
  }, [product.id]);

  function handleAddToBag() {
    if (!selectedVariant || !selectedVariant.availableForSale || !DROP_LIVE) return;

    const savedBag = window.localStorage.getItem(BAG_STORAGE_KEY);
    const currentBag = savedBag ? ((JSON.parse(savedBag) as BagItem[]) ?? []) : [];
    const optionsLabel = selectedVariant.selectedOptions
      .map((option) => option.value)
      .join(' / ');

    const existingItem = currentBag.find(
      (item) => item.variantId === selectedVariant.id,
    );

    const nextBag = existingItem
      ? currentBag.map((item) =>
          item.variantId === selectedVariant.id
            ? {...item, quantity: item.quantity + quantity}
            : item,
        )
      : [
          {
            imageUrl: selectedVariant.image?.url ?? product.image?.url ?? null,
            optionsLabel,
            price: selectedVariant.price,
            productHandle: product.handle,
            productTitle: product.title,
            quantity,
            variantId: selectedVariant.id,
            variantTitle: selectedVariant.title,
          },
          ...currentBag,
        ];

    console.log('[PDP AddToBag]', {
      availability: product.productAvailability,
      product: {
        handle: product.handle,
        id: product.id,
        title: product.title,
      },
      quantity,
      selectedVariant: {
        availableForSale: selectedVariant.availableForSale,
        id: selectedVariant.id,
        selectedOptions: selectedVariant.selectedOptions,
        title: selectedVariant.title,
      },
      variants: product.previewVariants.map((variant) => ({
        availableForSale: variant.availableForSale,
        id: variant.id,
        selectedOptions: variant.selectedOptions,
        title: variant.title,
      })),
    });

    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(nextBag));
    window.dispatchEvent(new Event('jellycat-bag-updated'));
    setAnnouncement(
      `${product.title}${
        optionsLabel ? ` • ${optionsLabel}` : ''
      } (x${quantity}) added to bag. Availability confirmed at checkout.`,
    );
  }

  return (
    <div className="product">
      <ProductImage image={image} title={product.title} />
      <ProductMain
        onAddToBag={handleAddToBag}
        onMarkVariantSoldOut={(variantId) =>
          setSoldOutVariantIds((current) => {
            const next = current.includes(variantId)
              ? current
              : [...current, variantId];
            writeSoldOutVariantIds(product.id, next);
            return next;
          })
        }
        onQuantityChange={setQuantity}
        product={{...product, previewVariants: uiVariants}}
        quantity={quantity}
        selectedOptions={selectedOptions}
        selectedVariant={selectedVariant}
      />
      {announcement ? (
        <div
          style={{
            position: 'fixed',
            right: '1rem',
            bottom: '1rem',
            background: '#111',
            color: '#fff',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            zIndex: 50,
          }}
        >
          {announcement}
        </div>
      ) : null}
    </div>
  );
}

function ProductImage({
  image,
  title,
}: {
  image: PlpVariant['image'] | PlpProduct['image'];
  title: string;
}) {
  if (!image) return <div className="product-image" />;

  return (
    <div className="product-image">
      <img
        alt={image.altText || title}
        className="aspect-square h-full w-full object-cover"
        height={image.height ?? 900}
        loading="eager"
        src={image.url}
        width={image.width ?? 900}
      />
    </div>
  );
}

function ProductMain({
  onAddToBag,
  onMarkVariantSoldOut,
  onQuantityChange,
  product,
  quantity,
  selectedOptions,
  selectedVariant,
}: {
  onAddToBag: () => void;
  onMarkVariantSoldOut: (variantId: string) => void;
  onQuantityChange: (quantity: number) => void;
  product: PlpProduct;
  quantity: number;
  selectedOptions: Record<string, string>;
  selectedVariant: PlpVariant | null;
}) {
  return (
    <div className="product-main">
      <h1>{product.title}</h1>
      <ProductPrice
        amount={selectedVariant?.price?.amount ?? product.priceRange.min?.amount}
      />
      <br />
      <ProductForm
        onAddToBag={onAddToBag}
        onMarkVariantSoldOut={onMarkVariantSoldOut}
        onQuantityChange={onQuantityChange}
        product={product}
        quantity={quantity}
        selectedOptions={selectedOptions}
        selectedVariant={selectedVariant}
      />
      <br />
      <br />
      <p>
        <strong>Description</strong>
      </p>
      <br />
      <p>
        Variant-aware PDP powered by the mock.shop adapter used by the PLP.
      </p>
      <br />
    </div>
  );
}

function ProductPrice({
  amount,
}: {
  amount?: string | null;
}) {
  return (
    <div className="product-price">
      {amount
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(amount))
        : 'Price unavailable'}
    </div>
  );
}

function ProductForm({
  onAddToBag,
  onMarkVariantSoldOut,
  onQuantityChange,
  product,
  quantity,
  selectedOptions,
  selectedVariant,
}: {
  onAddToBag: () => void;
  onMarkVariantSoldOut: (variantId: string) => void;
  onQuantityChange: (quantity: number) => void;
  product: PlpProduct;
  quantity: number;
  selectedOptions: Record<string, string>;
  selectedVariant: PlpVariant | null;
}) {
  const [isValidatingAdd, setIsValidatingAdd] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleValidatedAdd() {
    if (
      isValidatingAdd ||
      !selectedVariant ||
      !DROP_LIVE ||
      product.productAvailability === 'coming_soon'
    )
      return;
    setIsValidatingAdd(true);
    await delay(DROP_RACE_DELAY_MS);

    const latestVariant = await fetchLatestVariantAvailability({
      handle: product.handle,
      variantId: selectedVariant.id,
    });
    if (!latestVariant?.availableForSale) {
      onMarkVariantSoldOut(selectedVariant.id);
      setIsValidatingAdd(false);
      setErrorMessage('This product just sold out.');
      return;
    }

    if (
      DROP_RACE_CONDITION_ENABLED &&
      shouldInvalidateSelectedVariant({
        productId: product.id,
        productHandle: product.handle,
        selectedVariantId: selectedVariant.id,
        variants: product.previewVariants,
      })
    ) {
      onMarkVariantSoldOut(selectedVariant.id);
      setIsValidatingAdd(false);
      setErrorMessage('This product just sold out.');
      return;
    }

    setErrorMessage(null);
    onAddToBag();
    setIsValidatingAdd(false);
  }

  return (
    <div className="product-form">
      {product.optionGroups.map((group) => (
        <ProductOptions
          groupKey={group.key}
          groupName={group.label}
          key={group.key}
          product={product}
          selectedOptions={selectedOptions}
          selectedVariant={selectedVariant}
          values={group.values}
        />
      ))}
      <br />
      <div style={{marginBottom: '0.75rem'}}>
        <h5>Quantity</h5>
        <div className="product-options-grid">
          <button
            disabled={quantity <= 1}
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            type="button"
          >
            -
          </button>
          <span style={{minWidth: '2rem', textAlign: 'center'}}>{quantity}</span>
          <button onClick={() => onQuantityChange(quantity + 1)} type="button">
            +
          </button>
        </div>
      </div>
      <AddToCartButton
        disabled={
          !DROP_LIVE ||
          product.productAvailability === 'coming_soon' ||
          !selectedVariant?.availableForSale ||
          isValidatingAdd
        }
        onClick={handleValidatedAdd}
      >
        {isValidatingAdd ? (
          <span
            aria-label="Loading"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
            role="status"
          />
        ) : !DROP_LIVE || product.productAvailability === 'coming_soon' ? (
          'Coming soon'
        ) : selectedVariant?.availableForSale ? (
          'Add to bag'
        ) : (
          'Sold out'
        )}
      </AddToCartButton>
      <p style={{fontSize: '0.8rem', marginTop: '0.5rem', color: '#6b7280'}}>
        Availability confirmed at checkout.
      </p>
      {errorMessage ? (
        <p
          style={{
            fontSize: '0.8rem',
            marginTop: '0.5rem',
            color: '#fff',
            background: '#dc2626',
            borderRadius: '0.375rem',
            padding: '0.25rem 0.5rem',
            display: 'inline-block',
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function ProductOptions({
  groupKey,
  groupName,
  product,
  selectedOptions,
  selectedVariant,
  values,
}: {
  groupKey: string;
  groupName: string;
  product: PlpProduct;
  selectedOptions: Record<string, string>;
  selectedVariant: PlpVariant | null;
  values: string[];
}) {
  const visibleValues = values.filter((value) =>
    product.previewVariants.some((variant) => variant.optionValues[groupKey] === value),
  );

  return (
    <div className="product-options" key={groupKey}>
      <h5>{groupName}</h5>
      <div className="product-options-grid">
        {visibleValues.map((value) => {
          const nextSelection = {...selectedOptions, [groupKey]: value};
          const isAvailable = Boolean(
            findFirstMatchingAvailableVariant(product.previewVariants, nextSelection),
          );
          const isActive = selectedVariant?.optionValues[groupKey] === value;
          const to = getProductOptionUrl(product.handle, nextSelection);

          return (
            <Link
              className="product-options-item"
              key={`${groupKey}-${value}`}
              prefetch="intent"
              preventScrollReset
              replace
              style={{
                border: isActive ? '1px solid black' : '1px solid transparent',
                opacity: isAvailable ? 1 : 0.3,
              }}
              to={to}
            >
              {value}
            </Link>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function parseSelectedOptions(searchParams: URLSearchParams) {
  const selected: Record<string, string> = {};

  for (const [name, value] of searchParams.entries()) {
    if (!value) continue;
    selected[getOptionKey(name)] = value;
  }

  return selected;
}

function resolveSelectedVariant(
  product: PlpProduct,
  selectedOptions: Record<string, string>,
) {
  return (
    findFirstMatchingAvailableVariant(product.previewVariants, selectedOptions) ??
    findFirstMatchingVariant(product.previewVariants, selectedOptions) ??
    null
  );
}

function findFirstMatchingAvailableVariant(
  variants: PlpVariant[],
  selectedOptions: Record<string, string>,
) {
  return (
    variants.find(
      (variant) =>
        variant.availableForSale && variantMatchesSelection(variant, selectedOptions),
    ) ?? null
  );
}

function findFirstMatchingVariant(
  variants: PlpVariant[],
  selectedOptions: Record<string, string>,
) {
  return (
    variants.find((variant) => variantMatchesSelection(variant, selectedOptions)) ??
    null
  );
}

function variantMatchesSelection(
  variant: PlpVariant,
  selectedOptions: Record<string, string>,
) {
  return Object.entries(selectedOptions).every(
    ([key, value]) => variant.optionValues[key] === value,
  );
}

function getProductOptionUrl(handle: string, selectedOptions: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(selectedOptions)) {
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `/products/${handle}?${query}` : `/products/${handle}`;
}

function AddToCartButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shouldInvalidateSelectedVariant({
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

function readSoldOutVariantIds(productId: string) {
  try {
    const raw = window.localStorage.getItem(DROP_SOLD_OUT_STORAGE_KEY);
    const state = raw
      ? (JSON.parse(raw) as Record<string, string[]>)
      : {};
    return state[productId] ?? [];
  } catch {
    return [];
  }
}

function writeSoldOutVariantIds(productId: string, variantIds: string[]) {
  try {
    const raw = window.localStorage.getItem(DROP_SOLD_OUT_STORAGE_KEY);
    const state = raw
      ? (JSON.parse(raw) as Record<string, string[]>)
      : {};
    state[productId] = variantIds;
    window.localStorage.setItem(DROP_SOLD_OUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no-op in demo mode
  }
}

async function fetchLatestVariantAvailability({
  handle,
  variantId,
}: {
  handle: string;
  variantId: string;
}) {
  try {
    const response = await fetch(`/api/products/${handle}/variants`);
    if (!response.ok) return null;
    const data = (await response.json()) as LatestVariantResponse;
    return (
      data.product?.previewVariants.find((variant) => variant.id === variantId) ??
      null
    );
  } catch {
    return null;
  }
}
