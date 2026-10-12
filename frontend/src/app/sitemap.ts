import type { MetadataRoute } from 'next';
import { PUBLIC_SEARCH_PAGES, SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Redirect aliases, credentials/forms behind sign-in and private workspaces are excluded.
  // Omit lastModified rather than inventing a fresh content-edit timestamp on each build.
  return Object.keys(PUBLIC_SEARCH_PAGES).map((path) => ({ url: `${SITE_URL}${path === '/' ? '' : path}` }));
}
