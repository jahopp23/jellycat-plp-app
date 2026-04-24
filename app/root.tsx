import {defer, type LoaderArgs} from '@shopify/remix-oxygen';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useMatches,
  useRouteError,
  useLoaderData,
  ScrollRestoration,
  isRouteErrorResponse,
} from '@remix-run/react';
import type {CustomerAccessToken} from '@shopify/hydrogen-react/storefront-api-types';
import type {HydrogenSession} from '../server';
import favicon from '../public/favicon.svg';
import resetStyles from './styles/reset.css';
import appStyles from './styles/app.css';
import {Layout} from '~/components/Layout';
import {getProductCardImageUrl, type PlpProduct} from '~/lib/men-plp';
import tailwindCss from './styles/tailwind.css';

const ABOVE_THE_FOLD_IMAGE_COUNT = 4;
const LCP_IMAGE_COUNT = 1;

export function links() {
  return [
    {rel: 'stylesheet', href: tailwindCss},
    {rel: 'stylesheet', href: resetStyles},
    {rel: 'stylesheet', href: appStyles},
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export async function loader({context}: LoaderArgs) {
  const {storefront, session, cart} = context;
  const customerAccessToken = await session.get('customerAccessToken');
  const publicStoreDomain = context.env.PUBLIC_STORE_DOMAIN;

  // validate the customer access token is valid
  const {isLoggedIn, headers} = await validateCustomerAccessToken(
    customerAccessToken,
    session,
  );

  // defer the cart query by not awaiting it
  const cartPromise = cart.get().catch(() => null);

  // await the header query (above the fold)
  const headerPromise = storefront
    .query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    })
    .catch(() => getFallbackHeader(publicStoreDomain));

  return defer(
    {
      cart: cartPromise,
      header: await headerPromise,
      isLoggedIn,
      publicStoreDomain,
    },
    {headers},
  );
}

export default function App() {
  const data = useLoaderData<typeof loader>();
  const matches = useMatches();
  const aboveFoldImageUrls = getAboveFoldProductImageUrls(matches);
  const [lcpImageUrl, ...remainingAboveFoldImageUrls] = aboveFoldImageUrls;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {lcpImageUrl ? (
          <link
            as="image"
            href={lcpImageUrl}
            rel="preload"
            {...({'fetchpriority': 'high'} as Record<string, string>)}
          />
        ) : null}
        {remainingAboveFoldImageUrls.map((url) => (
          <link as="image" href={url} key={url} rel="preload" />
        ))}
      </head>
      <body>
        <Layout {...data}>
          <Outlet />
        </Layout>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const [root] = useMatches();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Layout {...root.data}>
          <div className="route-error">
            <h1>Oops</h1>
            <h2>{errorStatus}</h2>
            {errorMessage && (
              <fieldset>
                <pre>{errorMessage}</pre>
              </fieldset>
            )}
          </div>
        </Layout>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Validates the customer access token and returns a boolean and headers
 * @see https://shopify.dev/docs/api/storefront/latest/objects/CustomerAccessToken
 *
 * @example
 * ```ts
 * //
 * const {isLoggedIn, headers} = await validateCustomerAccessToken(
 *  customerAccessToken,
 *  session,
 *  );
 *  ```
 *  */
async function validateCustomerAccessToken(
  customerAccessToken: CustomerAccessToken,
  session: HydrogenSession,
) {
  let isLoggedIn = false;
  const headers = new Headers();
  if (!customerAccessToken?.accessToken || !customerAccessToken?.expiresAt) {
    return {isLoggedIn, headers};
  }
  const expiresAt = new Date(customerAccessToken.expiresAt);
  const dateNow = new Date();
  const customerAccessTokenExpired = expiresAt < dateNow;
  if (customerAccessTokenExpired) {
    session.unset('customerAccessToken');
    headers.append('Set-Cookie', await session.commit());
  } else {
    isLoggedIn = true;
  }

  return {isLoggedIn, headers};
}

function getFallbackHeader(publicStoreDomain: string | undefined) {
  return {
    menu: null,
    shop: {
      id: 'gid://shopify/Shop/mock-shop',
      name: 'Mock.shop',
      description: 'Mock.shop storefront',
      primaryDomain: {
        url: publicStoreDomain
          ? `https://${publicStoreDomain}`
          : 'https://mock.shop',
      },
      brand: {
        logo: null,
      },
    },
  };
}

function getAboveFoldProductImageUrls(matches: ReturnType<typeof useMatches>) {
  const routeMatchWithProducts = [...matches].reverse().find((match) => {
    const routeData = match.data as
      | {products?: PlpProduct[]; initialProducts?: PlpProduct[]}
      | undefined;
    return (
      Array.isArray(routeData?.products) ||
      Array.isArray(routeData?.initialProducts)
    );
  });

  const products =
    (
      routeMatchWithProducts?.data as
        | {products?: PlpProduct[]; initialProducts?: PlpProduct[]}
        | undefined
    )?.initialProducts ??
    (
      routeMatchWithProducts?.data as
        | {products?: PlpProduct[]; initialProducts?: PlpProduct[]}
        | undefined
    )?.products ??
    [];

  return Array.from(
    new Set(
      products
        .slice(0, Math.max(ABOVE_THE_FOLD_IMAGE_COUNT, LCP_IMAGE_COUNT))
        .map((product) => getInitialProductImageUrl(product))
        .filter((url): url is string => Boolean(url)),
    ),
  );
}

function getInitialProductImageUrl(product: PlpProduct) {
  const image =
    product.previewVariants.find(
      (variant) => variant.id === product.initialSelectedVariantId,
    )?.image?.url ??
    product.previewVariants.find((variant) => variant.availableForSale)?.image
      ?.url ??
    product.image?.url ??
    null;

  return image ? getProductCardImageUrl({url: image}) : null;
}

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    items {
      ...ParentMenuItem
    }
  }
` as const;

const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
    brand {
      logo {
        image {
          url
        }
      }
    }
  }
  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

