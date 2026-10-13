import type { ReactNode } from 'react';

import { type AppIcon } from '@/components/ui/icons';

export type DocsSection = { id: string; title: string; content: ReactNode; searchText?: string };
export type DocsChapter = {
  id: string;
  title: string;
  shortTitle: string;
  group: 'Start here' | 'Use KAINARA' | 'Review and evidence' | 'Policies and help';
  icon: AppIcon;
  tone: 'accent' | 'cyan' | 'green' | 'amber';
  aliases?: string[];
  summary: ReactNode;
  sections: DocsSection[];
};
export const inlineLink =
  'font-semibold text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:text-brand-greenHover';
