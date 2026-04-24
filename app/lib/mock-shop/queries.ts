export const MEN_COLLECTION_PRODUCTS_QUERY = `#graphql
  query MenCollectionProducts(
    $after: String
    $collectionHandle: String!
    $first: Int!
    $previewVariants: Int!
  ) {
    collection(handle: $collectionHandle) {
      id
      handle
      title
      products(first: $first, after: $after) {
        nodes {
          id
          title
          handle
          availableForSale
          featuredImage {
            url
            altText
            width
            height
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          options {
            name
            values
          }
          variants(first: $previewVariants) {
            nodes {
              id
              title
              availableForSale
              selectedOptions {
                name
                value
              }
              price {
                amount
                currencyCode
              }
              image {
                url
                altText
                width
                height
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
` as const;

export const PRODUCT_VARIANTS_QUERY = `#graphql
  query MenPlpProductVariants($after: String, $first: Int!, $handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      availableForSale
      featuredImage {
        url
        altText
        width
        height
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      options {
        name
        values
      }
      variants(first: $first, after: $after) {
        nodes {
          id
          title
          availableForSale
          selectedOptions {
            name
            value
          }
          price {
            amount
            currencyCode
          }
          image {
            url
            altText
            width
            height
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
` as const;
