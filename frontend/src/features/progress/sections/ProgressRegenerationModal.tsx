'use client';

import Button from '@/components/ui/Button';

import { Modal } from '@/components/ui/Modal';

import { CheckCircle2 } from 'lucide-react';

import type { useProgressWorkspaceModel } from './useProgressWorkspaceModel';
type Model = Extract<ReturnType<typeof useProgressWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'showRegenerateModal' | 'setShowRegenerateModal' | 'router'> };
export default function ProgressRegenerationModal({ model }: SectionProps) {
  const { showRegenerateModal, setShowRegenerateModal, router } = model;

  return (
    <>
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Profile Details Saved"
        description="Your health context and planning preferences have been updated."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <Button
              variant="primary"
              onClick={() => {
                setShowRegenerateModal(false);
                router.push('/profile/nutrition-report');
              }}
              className="text-xs font-bold w-full sm:w-auto shadow-md"
            >
              Review Updated Report
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-brand-muted">
              <strong className="text-brand-text block mb-1">When will your changes take effect?</strong>
              Your saved preferences apply to future planning. Existing meals are checked again for safety.
              <br className="mb-2" />
              Review and acknowledge your updated nutrition report now. Your active plan keeps its original planning
              targets unless a new safety restriction blocks an uneaten meal.
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
