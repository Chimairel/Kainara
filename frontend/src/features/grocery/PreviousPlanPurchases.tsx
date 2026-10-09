'use client';

import { Card } from '@/components/ui/Card';

export type PreviousPlanPurchase = { ingredientName: string; quantity: number; unit: string | null };

export default function PreviousPlanPurchases({ items }: { items: PreviousPlanPurchase[] }) {
  if (!items.length) return null;
  return (
    <Card className="mt-5 space-y-4 text-left" aria-label="Previous plan purchases">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-text">Previous plan purchases</h3>
        <p className="text-sm text-brand-muted">
          Recorded purchases are kept here. Confirm what remains before marking ingredients available in your new
          checklist.
        </p>
      </div>
      <ul className="divide-y divide-brand-border">
        {items.map((item, index) => (
          <li key={index} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
            <span>{item.ingredientName}</span>
            <span className="font-mono text-brand-muted">
              {item.quantity} {item.unit ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
