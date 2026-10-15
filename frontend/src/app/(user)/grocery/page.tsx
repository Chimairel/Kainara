import GroceryWorkspace from '@/features/grocery/GroceryWorkspace';
import { Suspense } from 'react';
import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';
export default function GroceryListPage() {
  return <Suspense fallback={<GrocerySkeleton />}><GroceryWorkspace /></Suspense>;
}
