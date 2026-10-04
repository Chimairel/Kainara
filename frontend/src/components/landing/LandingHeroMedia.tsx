import type { LandingMedia } from '@/features/website-content/types';
import LandingMediaDisplay from './LandingMediaDisplay';

export default function LandingHeroMedia({ media }: { media: LandingMedia | null }) {
  return <LandingMediaDisplay media={media} />;
}
