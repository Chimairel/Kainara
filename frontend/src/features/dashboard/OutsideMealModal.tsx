'use client';
import PreviewConfirmation from './OutsideMealPreview';
import type { OutsideMealModalProps as Props } from './outside-meal-modal.types';

import Modal from '@/components/ui/Modal';

import OutsideMealForm from './outside-meal/OutsideMealForm';
export function OutsideMealModal(props: Props) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={() => {
        if (!props.isLoading) props.onClose();
      }}
      title={props.warning ? 'Review your food log' : 'Log food or a meal'}
      size="xl"
      presentation="workspace"
      description={props.warning ? 'Check the portion, nutrition basis and any warnings before saving.' : 'Add what you ate outside your plan, then review the nutrition before saving.'}
    >
      <div className="flex flex-col gap-5 text-left">
        {props.warning && <PreviewConfirmation {...props} warning={props.warning} />}
        <div hidden={Boolean(props.warning)}>
          <OutsideMealForm {...props} />
        </div>
      </div>
    </Modal>
  );
}

export default OutsideMealModal;
