'use client';

import Button from '@/components/ui/Button';
import { Calendar, Plus, ShoppingBasket } from 'lucide-react';

export default function MemberMealActions({
  onLogFood,
  onOpenDestination,
  destination = 'plan',
}: {
  onLogFood: () => void;
  onOpenDestination: () => void;
  destination?: 'plan' | 'grocery';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={onLogFood}>
        <Plus className="h-4 w-4" /> Log food or snack
      </Button>
      <Button variant="secondary" onClick={onOpenDestination}>
        {destination === 'grocery' ? <ShoppingBasket className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
        {destination === 'grocery' ? 'Groceries' : 'Weekly plan'}
      </Button>
    </div>
  );
}
