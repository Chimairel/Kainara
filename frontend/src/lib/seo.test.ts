import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_SEARCH_PAGES, SITE_URL, publicPageMetadata, type PublicSearchPath } from './seo';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

afterEach(() => vi.unstubAllEnvs());
describe('public search boundaries', () => {
  it('indexes only public canonical pages on production and keeps private and redirect routes out of the sitemap', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    const pages = sitemap();
    expect(pages.map((page) => page.url)).toEqual([
      SITE_URL,
      `${SITE_URL}/pricing`,
      `${SITE_URL}/docs`,
      `${SITE_URL}/nutritionist-apply`,
    ]);
    for (const path of Object.keys(PUBLIC_SEARCH_PAGES) as PublicSearchPath[]) {
      const meta = publicPageMetadata(path);
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.alternates?.canonical).toBe(`${SITE_URL}${path === '/' ? '' : path}`);
    }
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/', disallow: '/api/' });
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
  it.each(['preview', 'development'])('prevents duplicate %s deployments from opting in to search', (environment) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', environment);
    expect(publicPageMetadata('/').robots).toEqual({ index: false, follow: true });
    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(robots().sitemap).toBeUndefined();
  });
});
