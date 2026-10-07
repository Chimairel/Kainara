'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import InteractiveCyberGrid from '@/components/ui/InteractiveCyberGrid';

export default function AuthHeroPanel({
  header,
  title,
  description,
}: {
  header: ReactNode;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden p-8 xl:p-12">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-green/15 blur-[90px]" />
      <div aria-hidden="true">
        <InteractiveCyberGrid cols={8} rows={10} accentIndices={[30, 50]} variant="adaptive" withMask />
      </div>
      <header className="relative z-10 flex items-center justify-between gap-4">{header}</header>
      <div className="pointer-events-none relative z-10 my-auto max-w-xl py-10">
        <div className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full border border-brand-green/25 bg-brand-green/10 px-3 py-1 text-brand-green">
          <Sparkles className="h-3.5 w-3.5" /> Your personal nutrition system
        </div>
        <h2 className="font-display text-[clamp(3rem,4.7vw,5.5rem)] font-black leading-[0.98] tracking-[-0.055em]">
          {title}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-brand-muted">{description}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {[
            { label: 'Culturally familiar', Icon: UtensilsCrossed },
            { label: 'Review-aware', Icon: ShieldCheck },
            { label: 'Built for context', Icon: CheckCircle2 },
          ].map(({ label, Icon }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-2xl border border-brand-border bg-brand-surface/80 px-3 py-3 text-xs font-semibold"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-brand-green" />
              {label}
            </div>
          ))}
        </div>
      </div>
      <div />
    </div>
  );
}
