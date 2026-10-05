'use client';
import { BarChart3, ShieldCheck } from 'lucide-react';
import AdminTabbedWorkspace from '@/features/admin-workspace/AdminTabbedWorkspace';
import AdminStatistics from './AdminStatistics';
import AdminSafetyPanel from './AdminSafetyPanel';

export default function AdminOverviewWorkspace() {
  return (
    <AdminTabbedWorkspace
      title="Overview"
      description="Platform statistics, usage history, and safety operations in one workspace."
      tabs={[
        {
          id: 'summary',
          label: 'Summary & analytics',
          icon: BarChart3,
          render: (active) => <AdminStatistics active={active} />,
        },
        {
          id: 'safety',
          label: 'Safety operations',
          icon: ShieldCheck,
          render: (active) => <AdminSafetyPanel active={active} />,
        },
      ]}
    />
  );
}
