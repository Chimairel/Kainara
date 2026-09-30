'use client';

import CaseReviewWorkspace from '@/features/nutritionist-reviews/CaseReviewWorkspace';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';
import { useReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';
import ApprovedReviewsPage from '../approved/page';
import OutsideMealReviewsPage from '../outside-meals/page';
import GovernanceQueuePanel from './GovernanceQueuePanel';
import MealVerificationPanel from './MealVerificationPanel';
import ProfileWorkPanel from './ProfileWorkPanel';
import WorkspaceTabs, { type ReviewWorkspace } from './WorkspaceTabs';

export default function ReviewsPage() {
  const workCounts = useReviewWorkCounts();
  const [workspace, setWorkspace] = useState<ReviewWorkspace>('case');
  const [caseFilter, setCaseFilter] = useState<'pending' | 'second' | 'disputed' | 'outside' | 'completed'>('pending');
  const [expanded, setExpanded] = useState(false);
  const review = useNutritionistReviews(workspace === 'case' && (caseFilter === 'pending' || caseFilter === 'second'));

  const navigation = (
    <WorkspaceTabs
      value={workspace}
      counts={workCounts}
      onChange={(next) => {
        setWorkspace(next);
        setExpanded(false);
      }}
    />
  );

  const caseFilters = (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-brand-border/70 bg-brand-surface/75 p-1.5 shadow-sm backdrop-blur-md"
      aria-label="Case approval filters"
    >
      {(
        [
          ['pending', 'Pending'],
          ['second', 'Second decision'],
          ['outside', 'Outside food logs'],
          ['completed', 'Completed history'],
          ['disputed', 'Needs resolution'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={caseFilter === key}
          onClick={() => {
            setCaseFilter(key);
            setExpanded(false);
          }}
          className={`group relative flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 font-display text-xs font-extrabold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green ${
            caseFilter === key
              ? 'bg-brand-accent text-[#07100d] font-black shadow-sm'
              : 'text-brand-muted hover:bg-brand-bgAlt/80 hover:text-brand-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (workspace === 'meal') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          <MealVerificationPanel />
        </div>
      </div>
    );
  }

  if (workspace === 'profile') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          <ProfileWorkPanel />
        </div>
      </div>
    );
  }

  if (caseFilter === 'disputed') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          {caseFilters}
          <GovernanceQueuePanel tab={caseFilter} />
        </div>
      </div>
    );
  }

  if (caseFilter === 'outside') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          {caseFilters}
          <OutsideMealReviewsPage />
        </div>
      </div>
    );
  }

  if (caseFilter === 'completed') {
    return (
      <div className="portal-page space-y-5 pb-20 text-brand-text">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <PortalPageHeader
            icon={ShieldCheck}
            eyebrow="Clinical workspace"
            title="Reviews"
            description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
          />
          {navigation}
          {caseFilters}
          <ApprovedReviewsPage />
        </div>
      </div>
    );
  }

  return (
    <CaseReviewWorkspace
      review={review}
      caseFilter={caseFilter}
      expanded={expanded}
      setExpanded={setExpanded}
      navigation={navigation}
      caseFilters={caseFilters}
    />
  );
}
