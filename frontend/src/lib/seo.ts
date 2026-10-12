import type { Metadata } from 'next';

/** Matches the existing apex-to-www redirect; never derive canonicals from request headers. */
export const SITE_URL = 'https://www.kainara.site';
export const SITE_NAME = 'Kainara';
export const PUBLIC_SEARCH_PAGES = {
  '/': {
    title: 'Filipino Meal Planning & Nutrition Tracking | Kainara',
    description:
      'Plan meals with Filipino recipes, track your nutrition and explore food guidance with Kainara. Includes AI-assisted planning and RND review workflows.',
  },
  '/pricing': {
    title: 'Meal Planning Plans & Pricing | Kainara',
    description:
      'Compare Kainara Free, Lifestyle and Health plans for Filipino meal planning, nutrition tracking, changing goals and RND review for applicable cases.',
  },
  '/docs': {
    title: 'User Guide, Nutrition Sources & Policies | Kainara',
    description:
      'Learn how Kainara meal planning, food tracking and RND review work. Read nutrition data sources, privacy information, terms and the user guide.',
  },
  '/nutritionist-apply': {
    title: 'Apply as a Registered Nutritionist-Dietitian | Kainara',
    description:
      'Apply to join Kainara as a Registered Nutritionist-Dietitian. Submit your PRC credentials for administrator verification and access nutrition review workflows.',
  },
} as const;
export type PublicSearchPath = keyof typeof PUBLIC_SEARCH_PAGES;

export function publicPageMetadata(path: PublicSearchPath): Metadata {
  const page = PUBLIC_SEARCH_PAGES[path];
  const index =
    process.env.NODE_ENV === 'production' &&
    process.env.VERCEL_ENV !== 'preview' &&
    process.env.VERCEL_ENV !== 'development';
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}${path === '/' ? '' : path}` },
    robots: { index, follow: true },
    openGraph: {
      ...page,
      url: `${SITE_URL}${path === '/' ? '' : path}`,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_PH',
      images: [
        {
          url: `${SITE_URL}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: 'Kainara — Filipino meal planning and nutrition tracking',
        },
      ],
    },
    twitter: { card: 'summary_large_image', ...page, images: [`${SITE_URL}/opengraph-image`] },
  };
}

export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: 'KAINARA',
      url: SITE_URL,
      inLanguage: 'en-PH',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
  ],
};
