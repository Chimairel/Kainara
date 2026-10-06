'use client';

import { MotionConfig } from 'motion/react';

import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';

import type { LandingMedia } from '@/features/website-content/types';

import { useLandingHomeModel } from '@/features/landing/useLandingHomeModel';
import LandingHeroSection from '@/features/landing/LandingHeroSection';
import LandingPlatformSection from '@/features/landing/LandingPlatformSection';
import LandingProcessSection from '@/features/landing/LandingProcessSection';
import LandingNutritionistsSection from '@/features/landing/LandingNutritionistsSection';
import LandingSourcesSection from '@/features/landing/LandingSourcesSection';
import LandingGuidesSection from '@/features/landing/LandingGuidesSection';
import LandingCallToAction from '@/features/landing/LandingCallToAction';
export default function LandingHome({ initialMedia }: { initialMedia: LandingMedia | null }) {
  const model = useLandingHomeModel({ initialMedia });
  if (model.kind === 'early') return model.view;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white">
        <PublicHeader />

        <main className="overflow-x-clip">
          {/* HERO SECTION */}
          <LandingHeroSection model={model} />

          {/* PLATFORM INTELLIGENCE BENTO GRID */}
          <LandingPlatformSection />

          {/* THE INTELLIGENCE LOOP (FOREST PINE CONTINENT WITH ORGANIC WAVE BORDERS) */}
          <LandingProcessSection />

          {/* NUTRITIONIST RND RECRUITMENT */}
          <LandingNutritionistsSection />

          {/* EVIDENCE AND SOURCES */}
          <LandingSourcesSection />

          {/* DOCUMENTATION & GUIDES */}
          <LandingGuidesSection />

          {/* BOTTOM CALL TO ACTION */}
          <LandingCallToAction model={model} />
        </main>

        <PublicFooter />
      </div>
    </MotionConfig>
  );
}
