import type {V2_MetaFunction} from '@shopify/remix-oxygen';
import {json, type LoaderArgs} from '@shopify/remix-oxygen';
import {useLoaderData} from '@remix-run/react';

export const meta: V2_MetaFunction = ({data}) => {
  const pageTitle = data?.page?.title ?? 'Page';
  return [{title: `Hydrogen | ${pageTitle}`}];
};

export async function loader({params, context}: LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  let page: {
    id: string;
    title: string;
    body: string;
    seo?: {description?: string | null; title?: string | null} | null;
  } | null = null;

  try {
    const response = await context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    });
    page = response.page ?? null;
  } catch {
    // Some environments (e.g. mock storefront data sources) do not support the
    // full Page query surface. Treat failed lookups as a missing page instead of
    // surfacing Storefront API errors in local console output.
    throw new Response('Not Found', {status: 404});
  }

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  return json({page});
}

export default function Page() {
  const {page} = useLoaderData<typeof loader>();

  return (
    <div className="page">
      <header>
        <h1>{page.title}</h1>
      </header>
      <main dangerouslySetInnerHTML={{__html: page.body}} />
    </div>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
