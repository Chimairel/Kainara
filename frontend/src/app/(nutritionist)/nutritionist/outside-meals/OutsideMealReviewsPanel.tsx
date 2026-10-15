'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { ClipboardCheck } from '@/components/ui/icons';

import PortalPageHeader from '@/components/shared/PortalPageHeader';

import { useOutsideMealReviewsPanelModel } from '@/features/nutritionist-outside-meals/useOutsideMealReviewsPanelModel';
import OutsideMealReviewQueue from '@/features/nutritionist-outside-meals/OutsideMealReviewQueue';
import OutsideMealReviewDetail from '@/features/nutritionist-outside-meals/OutsideMealReviewDetail';
import ObservedMealCorpusSection from '@/features/nutritionist-outside-meals/ObservedMealCorpusSection';
import { useState } from 'react';
import SplitWorkspace from '@/components/shared/SplitWorkspace';
export default function OutsideMealReviewsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const model = useOutsideMealReviewsPanelModel({ embedded });
  const [expanded, setExpanded] = useState(false);

  const { error } = model;
  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PortalPageHeader
          icon={ClipboardCheck}
          eyebrow="Nutrition review"
          title="Outside food feedback"
          description="Send advice on logged food. Members’ recorded nutrition stays unchanged."
        />
      )}

      {error && (
        <FeedbackNotice>
          <span>{error}</span>
        </FeedbackNotice>
      )}

      <SplitWorkspace className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] overflow-hidden rounded-3xl border border-brand-border bg-brand-surface">
        {/* Left Column: Outside Food Queue */}
        <OutsideMealReviewQueue model={model} expanded={expanded} />

        {/* Right Column: Workflow Guide or Active Inspection Form */}
        <div className="min-w-0 flex-1"><OutsideMealReviewDetail model={model} expanded={expanded} setExpanded={setExpanded} /></div>
      </SplitWorkspace>

      {/* Consented Food Observations Section */}
      <ObservedMealCorpusSection model={model} />
    </div>
  );
}
