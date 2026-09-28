import { UtensilsCrossed, ShieldCheck, UserCheck } from 'lucide-react';
import { formatBadgeCount } from '@/lib/badge-count';
import type { ReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';

export type ReviewWorkspace = 'meal' | 'case' | 'profile';

const WORKSPACE_TABS = [
  { key: 'meal', label: 'Meal verification', icon: UtensilsCrossed },
  { key: 'case', label: 'Case approval', icon: ShieldCheck },
  { key: 'profile', label: 'Profile queue', icon: UserCheck },
] as const;

export default function WorkspaceTabs({
  value,
  onChange,
  counts,
}: {
  value: ReviewWorkspace;
  onChange: (value: ReviewWorkspace) => void;
  counts: ReviewWorkCounts | null;
}) {
  return (
    <nav
      aria-label="Nutritionist review queues"
      className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-1.5 shadow-sm backdrop-blur-md"
    >
      {WORKSPACE_TABS.map(({ key, label, icon: Icon }) => {
        const count = counts ? counts[key] : 0;
        const isActive = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(key)}
            className={`group relative flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xs font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface sm:text-sm ${
              isActive
                ? 'text-[#07100d]'
                : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'
            }`}
          >
            {isActive && (
              <MotionActiveIndicator
                layoutId="nutritionist-workspace-tab-indicator"
                className="rounded-2xl bg-brand-accent shadow-neon"
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black transition-colors ${
                    isActive ? 'bg-[#07100d]/15 text-[#07100d]' : 'bg-brand-bgAlt text-brand-muted'
                  }`}
                  aria-label={`${count} outstanding`}
                >
                  {formatBadgeCount(count)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
