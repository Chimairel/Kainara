'use client';
import AdminTabbedWorkspace from '@/features/admin-workspace/AdminTabbedWorkspace';
import AdminAccountsPanel from './AdminAccountsPanel';
import AdminNutritionistsPanel from '@/features/admin-nutritionists/AdminNutritionistsPanel';

export default function AdminPeopleWorkspace() {
  return (
    <AdminTabbedWorkspace
      title="People"
      description="Manage accounts, nutritionist applications, and professional access."
      tabs={[
        { id: 'accounts', label: 'Accounts', render: (active) => <AdminAccountsPanel active={active} /> },
        {
          id: 'nutritionists',
          label: 'Nutritionists',
          render: (active) => <AdminNutritionistsPanel active={active} />,
        },
      ]}
    />
  );
}
