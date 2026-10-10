'use client';
import StateNotice from '@/components/shared/StateNotice';

/** A pending review can be waiting on either party; keep its next step visible. */
export default function ProfileReviewPlanningHold() {
  return (
    <StateNotice
      variant="no-meal-plan"
      eyebrow="Profile review"
      eyebrowVariant="amber"
      title="Meal planning isn't available yet"
      description="Check Health details for RND questions or proposed corrections. An RND must confirm your current health profile before meal candidates can be prepared. Meal eligibility and approval are checked separately."
      action={{ label: 'View Health details', href: '/profile/clinical-evidence' }}
    />
  );
}
