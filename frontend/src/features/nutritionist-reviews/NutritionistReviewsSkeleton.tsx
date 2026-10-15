import { QueueSkeleton } from '@/components/shared/WorkspaceQueue';
import type { CSSProperties } from 'react';
import { LoaderSkeleton } from '@/components/ui/loaders-skeleton';
import SplitWorkspace, { WorkspaceListPane } from '@/components/shared/SplitWorkspace';

export function ReviewQueueSkeleton({ count = 5 }: { count?: number }) {
  return <QueueSkeleton count={count} />;
}
export function ReviewDetailSkeleton() {
  return (
    <div aria-label="Loading review details" aria-busy="true" className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface">
      <div aria-hidden="true" className="flex items-center justify-between gap-6 border-b border-brand-border p-4">
        <LoaderSkeleton width="45%" height={16} />
        <LoaderSkeleton width={120} height={36} borderRadius={20} />
      </div>
      <div aria-hidden="true" className="flex items-center gap-5 border-b border-brand-border px-4 py-3">
        {[16, 32, 16, 16, 16, 16].map((width, i) => <LoaderSkeleton key={i} width={width} height={16} borderRadius={6} />)}
      </div>
      <div aria-hidden="true" className="relative flex min-h-0 flex-1 gap-5 overflow-hidden bg-brand-bgAlt/40 bg-[radial-gradient(var(--brand-border)_1px,transparent_1px)] p-6 [background-size:20px_20px]">
        {[0, 1].map(i => <div key={i} className="min-w-[220px] flex-1 space-y-5 self-start bg-white p-5 shadow-card"
          style={{ '--skeleton-bg': 'rgba(13, 40, 32, 0.075)', '--skeleton-highlight': 'rgba(255, 255, 255, 0.6)' } as CSSProperties}>
          <LoaderSkeleton width="75%" height={18} />
          <LoaderSkeleton width="45%" height={10} />
          {i === 1 && <LoaderSkeleton height={100} borderRadius={12} />}
          {[0, 1, 2].map(j => <div key={j} className="space-y-2 border-t border-[#dce4e0] pt-4">
            <LoaderSkeleton width="55%" height={12} />
            <LoaderSkeleton height={10} />
            <LoaderSkeleton width="80%" height={10} />
          </div>)}
        </div>)}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4 rounded-2xl bg-brand-surface px-5 py-3 shadow-card">
          {[0, 1, 2, 3, 4].map(i => <LoaderSkeleton key={i} width={16} height={16} borderRadius={6} />)}
        </div>
      </div>
    </div>
  );
}
export function NutritionistReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading RND review workspace" aria-busy="true">
      <header aria-hidden="true" className="workspace-header space-y-3">
        <LoaderSkeleton width={160} height={36} borderRadius={8} />
        <LoaderSkeleton width="65%" height={16} />
      </header>
      <div aria-hidden="true" className="flex items-center justify-around gap-4 rounded-[22px] border border-brand-border/70 bg-brand-surface p-4">
        {[0, 1, 2].map(i => <LoaderSkeleton key={i} width="22%" height={16} />)}
      </div>
      <div aria-hidden="true" className="flex w-64 max-w-full gap-3 self-start rounded-full border border-brand-border bg-brand-surface p-3">
        <LoaderSkeleton width="40%" height={16} />
        <LoaderSkeleton width="54%" height={16} />
      </div>
      <SplitWorkspace className="md:h-[calc(100vh-270px)] md:min-h-[640px] rounded-3xl">
        <WorkspaceListPane>
          <div aria-hidden="true" className="space-y-3 border-b border-brand-border/70 pb-4">
            <div className="flex justify-between"><LoaderSkeleton width={100} height={20} /><LoaderSkeleton width={18} height={16} /></div>
            <LoaderSkeleton height={12} />
            <LoaderSkeleton width="70%" height={12} />
            <LoaderSkeleton height={40} borderRadius={12} />
          </div>
          <ReviewQueueSkeleton count={5} />
        </WorkspaceListPane>
        <div aria-hidden="true" className="hidden min-w-0 flex-1 p-8 md:block lg:p-12">
          <div className="max-w-lg space-y-5">
            <LoaderSkeleton width={28} height={28} borderRadius={6} />
            <LoaderSkeleton width="70%" height={30} borderRadius={6} />
            <div className="space-y-2"><LoaderSkeleton height={14} /><LoaderSkeleton width="85%" height={14} /></div>
            <div className="space-y-7 pt-5">
              {[0, 1, 2].map(i => <div key={i} className="flex gap-4">
                <LoaderSkeleton width={18} height={18} />
                <div className="flex-1 space-y-3"><LoaderSkeleton width="65%" height={18} /><LoaderSkeleton height={12} /><LoaderSkeleton width="80%" height={12} /></div>
              </div>)}
            </div>
          </div>
        </div>
      </SplitWorkspace>
    </div>
  );
}
export default NutritionistReviewsSkeleton;
