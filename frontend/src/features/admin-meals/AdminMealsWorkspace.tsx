'use client';
import AdminTabbedWorkspace from '@/features/admin-workspace/AdminTabbedWorkspace';
import SharedMealLibraryWorkspace from '@/features/nutritionist-library/SharedMealLibraryWorkspace';
import AdminMealAuthoringWorkspace from './AdminMealAuthoringWorkspace';

export default function AdminMealsWorkspace() {
  return (
    <AdminTabbedWorkspace
      title="Meals"
      description="Browse the shared meal library, flag recipes, and author drafts for RND review."
      tabAliases={{ batch: 'author' }}
      tabs={[
        {
          id: 'library',
          label: 'Meal library',
          render: (active) => <SharedMealLibraryWorkspace role="admin" embedded active={active} />,
        },
        { id: 'author', label: 'Author meals', render: (active) => <AdminMealAuthoringWorkspace active={active} /> },
      ]}
    />
  );
}
