'use client';
import PreviewConfirmation from './OutsideMealPreview';
import type { OutsideMealModalProps as Props } from './outside-meal-modal.types';

import Modal from '@/components/ui/Modal';

import OutsideMealForm from './outside-meal/OutsideMealForm';
import OutsideReviewRequestButton from '@/features/membership/OutsideReviewRequestButton';
import Link from 'next/link';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
export function OutsideMealModal(props: Props) {
  return (
    <>
      <Modal
        isOpen={props.isOpen}
        onClose={() => {
          if (!props.isLoading) props.onClose();
        }}
        title={props.warning ? 'Review your food log' : 'Log food or a meal'}
        size="xl"
        presentation="workspace"
        description={
          props.warning
            ? 'Check the portion, nutrition basis and any warnings before saving.'
            : 'Add what you ate outside your plan, then review the nutrition before saving.'
        }
      >
        <div className="flex flex-col gap-5 text-left">
          {props.warning && <PreviewConfirmation {...props} warning={props.warning} />}
          <div hidden={Boolean(props.warning)}>
            <OutsideMealForm {...props} />
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(props.savedFood)}
        onClose={() => {
          if (!props.feedbackBusy) props.onDismissFeedback?.();
        }}
        title="Food logged"
        description="Your intake is saved. Would you like an RND to give feedback on this food?"
        size="md"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-brand-muted">
            Feedback is optional and separate from saving your food. It does not turn an estimate into a verified
            nutrition value or medical clearance.
          </p>
          {props.feedbackError && <FeedbackNotice>{props.feedbackError}</FeedbackNotice>}
          {props.savedFood?.itemId ? (
            <OutsideReviewRequestButton
              busy={Boolean(props.feedbackBusy)}
              onRequest={() => props.onRequestFeedback?.()}
            />
          ) : (
            <p className="text-sm text-brand-muted">
              Open Meal history to check whether feedback is available for this entry.
            </p>
          )}
          {!props.feedbackBusy && (
            <Link
              href="/meals?tab=history"
              onClick={() => props.onDismissFeedback?.()}
              className="inline-block text-sm font-semibold text-brand-green underline underline-offset-4"
            >
              View Meal history
            </Link>
          )}
          <p className="text-xs text-brand-muted">
            Close this window to skip. You can request feedback later from this food’s history entry.
          </p>
        </div>
      </Modal>
    </>
  );
}

export default OutsideMealModal;
