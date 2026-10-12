import type { ReactNode } from 'react';
import { publicPageMetadata } from '@/lib/seo';

export const metadata = publicPageMetadata('/pricing');
export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
