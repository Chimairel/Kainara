'use client';

import Button from '@/components/ui/Button';
import { Calendar, Plus, ShoppingBasket } from '@/components/ui/icons';

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
    <div className="grid w-full grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-2 sm:flex sm:w-auto sm:flex-wrap">
      <Button variant="primary" className="max-sm:min-h-11 max-sm:px-2" onClick={onLogFood}>
        <Plus className="h-4 w-4" /> Log food or snack
      </Button>
      <Button variant="secondary" className="max-sm:min-h-11 max-sm:px-2" onClick={onOpenDestination}>
        {destination === 'grocery' ? <ShoppingBasket className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
        {destination === 'grocery' ? 'Groceries' : 'Weekly plan'}
      </Button>
    </div>
  );
}
