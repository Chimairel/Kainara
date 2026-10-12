'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { ClipboardCheck } from 'lucide-react';

import PortalPageHeader from '@/components/shared/PortalPageHeader';

import { useOutsideMealReviewsPanelModel } from '@/features/nutritionist-outside-meals/useOutsideMealReviewsPanelModel';
import OutsideMealReviewQueue from '@/features/nutritionist-outside-meals/OutsideMealReviewQueue';
import OutsideMealReviewDetail from '@/features/nutritionist-outside-meals/OutsideMealReviewDetail';
import ObservedMealCorpusSection from '@/features/nutritionist-outside-meals/ObservedMealCorpusSection';
export default function OutsideMealReviewsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const model = useOutsideMealReviewsPanelModel({ embedded });

  const { error } = model;
  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PortalPageHeader
          icon={ClipboardCheck}
          eyebrow="Nutrition review"
          title="Outside food estimates"
          description="Confirm an intake estimate, correct it, ask for detail, or mark it unverifiable. This does not certify a reusable recipe."
        />
      )}

      {error && (
        <FeedbackNotice>
          <span>{error}</span>
        </FeedbackNotice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] items-start">
        {/* Left Column: Outside Food Queue */}
        <OutsideMealReviewQueue model={model} />

        {/* Right Column: Workflow Guide or Active Inspection Form */}
        <OutsideMealReviewDetail model={model} />
      </div>

      {/* Consented Food Observations Section */}
      <ObservedMealCorpusSection model={model} />
    </div>
  );
}
