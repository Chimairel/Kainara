'use client';
import { UserCheck } from 'lucide-react';
import { useProfileWorkPanelModel } from '@/features/nutritionist-profile-review/useProfileWorkPanelModel';
import ProfileReviewQueue from '@/features/nutritionist-profile-review/ProfileReviewQueue';
import ProfileWorkCanvas from '@/features/nutritionist-profile-review/ProfileWorkCanvas';
export default function ProfileWorkPanel() {
  const model = useProfileWorkPanelModel();
  return (
    <div className="flex h-[calc(100vh-270px)] min-h-[640px] overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface shadow-sm">
      <ProfileReviewQueue model={model} />
      <div className="min-w-0 flex-1 overflow-auto p-4">
        {model.error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-500/30 p-3 text-sm text-red-500">
            {model.error}
          </p>
        )}
        {model.detail ? (
          <ProfileWorkCanvas model={model} />
        ) : (
          <div className="p-6 text-brand-muted">
            <UserCheck className="mb-3 h-8 w-8 text-brand-green" />
            <h2 className="font-display text-xl font-bold text-brand-text">Select a person</h2>
            <p className="mt-2 text-sm">Their saved guidance, uploaded documents, and review tasks appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
