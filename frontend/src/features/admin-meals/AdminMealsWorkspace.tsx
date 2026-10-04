'use client';
import AdminTabbedWorkspace from '@/features/admin-workspace/AdminTabbedWorkspace';
import SharedMealLibraryWorkspace from '@/features/nutritionist-library/SharedMealLibraryWorkspace';
import AdminMealAuthoring from './AdminMealAuthoring';

export default function AdminMealsWorkspace() {
  return (
    <AdminTabbedWorkspace
      title="Meals"
      description="Browse the shared meal library, flag recipes, and author drafts for nutritionist review."
      tabs={[
        {
          id: 'library',
          label: 'Meal library',
          render: (active) => <SharedMealLibraryWorkspace role="admin" embedded active={active} />,
        },
        { id: 'author', label: 'Author meals', render: (active) => <AdminMealAuthoring active={active} /> },
      ]}
    />
  );
}
