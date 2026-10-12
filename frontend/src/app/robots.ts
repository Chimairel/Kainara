import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const production =
    process.env.NODE_ENV === 'production' &&
    process.env.VERCEL_ENV !== 'preview' &&
    process.env.VERCEL_ENV !== 'development';
  return {
    // HTML routes remain crawlable so crawlers can read their noindex metadata.
    // Authentication, not robots.txt, protects member and professional records.
    rules: { userAgent: '*', ...(production ? { allow: '/', disallow: '/api/' } : { disallow: '/' }) },
    ...(production ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
