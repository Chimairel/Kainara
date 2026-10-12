import type { ReactNode } from 'react';
import { publicPageMetadata } from '@/lib/seo';

export const metadata = publicPageMetadata('/nutritionist-apply');
export default function NutritionistApplyLayout({ children }: { children: ReactNode }) {
  return children;
}
