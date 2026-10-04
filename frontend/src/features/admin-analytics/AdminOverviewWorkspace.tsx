'use client';
import AdminTabbedWorkspace from '@/features/admin-workspace/AdminTabbedWorkspace';
import AdminStatistics from './AdminStatistics';
import AdminSafetyPanel from './AdminSafetyPanel';

export default function AdminOverviewWorkspace() {
  return (
    <AdminTabbedWorkspace
      title="Overview"
      description="Platform statistics, usage history, and safety operations in one workspace."
      tabs={[
        { id: 'summary', label: 'Summary & analytics', render: (active) => <AdminStatistics active={active} /> },
        { id: 'safety', label: 'Safety operations', render: (active) => <AdminSafetyPanel active={active} /> },
      ]}
    />
  );
}
