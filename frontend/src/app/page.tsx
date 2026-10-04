import LandingHome from '@/components/landing/LandingHome';
import { getPublishedLandingMedia } from '@/features/website-content/landing-media.server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const media = await getPublishedLandingMedia();
  return <LandingHome initialMedia={media} />;
}
