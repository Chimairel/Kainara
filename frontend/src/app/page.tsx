import LandingHome from '@/components/landing/LandingHome';
import { getPublishedLandingMedia } from '@/features/website-content/landing-media.server';
import { publicPageMetadata, websiteStructuredData } from '@/lib/seo';

export const metadata = publicPageMetadata('/');

export const dynamic = 'force-dynamic';

export default async function Home() {
  const media = await getPublishedLandingMedia();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, '\\u003c') }}
      />
      <LandingHome initialMedia={media} />
    </>
  );
}
