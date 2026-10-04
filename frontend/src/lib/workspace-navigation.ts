import {
  Activity,
  Sparkles,
  ClipboardList,
  Database,
  Download,
  HeartPulse,
  Home,
  ImageIcon,
  ShieldCheck,
  ShoppingCart,
  ScrollText,
  Soup,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type WorkspaceRole = 'USER' | 'NUTRITIONIST' | 'ADMIN';
export type WorkspaceTool = { label: string; href: string; description: string; group: string; icon: LucideIcon };
export const workspaceLabels: Record<WorkspaceRole, string> = {
  USER: 'Personal portal',
  NUTRITIONIST: 'Clinical portal',
  ADMIN: 'Control center',
};
export const workspaceTools: Record<WorkspaceRole, WorkspaceTool[]> = {
  USER: [
    {
      label: 'Membership',
      href: '/membership',
      description: 'Pro status, benefits and remaining allowances.',
      group: 'Your account',
      icon: Sparkles,
    },
    {
      label: 'Home',
      href: '/dashboard',
      description: 'Daily meals, nutrition totals, water, and check-ins.',
      group: 'Every day',
      icon: Home,
    },
    {
      label: 'Meals',
      href: '/meals',
      description: 'Your weekly plan, meal history, swaps, and library.',
      group: 'Every day',
      icon: Soup,
    },
    {
      label: 'Groceries',
      href: '/grocery',
      description: 'Approved ingredients, pantry items, and shopping PDF.',
      group: 'Every day',
      icon: ShoppingCart,
    },
    {
      label: 'Progress',
      href: '/progress',
      description: 'Log weight and follow your nutrition history.',
      group: 'Your health',
      icon: Activity,
    },
    {
      label: 'Health & goals',
      href: '/profile/health',
      description: 'Goals, conditions, allergies, location, and food preferences.',
      group: 'Your health',
      icon: HeartPulse,
    },
    {
      label: 'Profile',
      href: '/profile',
      description: 'Personal details, avatar, and account security.',
      group: 'Your account',
      icon: User,
    },
    {
      label: 'Exports',
      href: '/export',
      description: 'Download available nutrition and meal-plan reports.',
      group: 'Your account',
      icon: Download,
    },
  ],
  NUTRITIONIST: [
    {
      label: 'Reviews',
      href: '/nutritionist/reviews',
      description: 'Claim, inspect, correct, and review meal-plan rows.',
      group: 'Review work',
      icon: ClipboardList,
    },
    {
      label: 'Meal library',
      href: '/nutritionist/library',
      description: 'Manage recipes, ingredient evidence, and flags.',
      group: 'Professional tools',
      icon: Soup,
    },
    {
      label: 'Audit',
      href: '/nutritionist/audit',
      description: 'Review clinical activity and due rechecks.',
      group: 'Review work',
      icon: ScrollText,
    },
  ],
  ADMIN: [
    {
      label: 'Overview',
      href: '/admin/overview',
      description: 'Account totals, review queues, and platform signals.',
      group: 'Platform',
      icon: Home,
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      description: 'Explore nutrition and usage trends.',
      group: 'Platform',
      icon: Activity,
    },
    {
      label: 'Operations',
      href: '/admin/operations',
      description: 'Monitor processing, reconciliation, and operational status.',
      group: 'Platform',
      icon: ShieldCheck,
    },
    {
      label: 'Accounts',
      href: '/admin/users',
      description: 'Search and manage member, nutritionist and admin accounts.',
      group: 'People',
      icon: Users,
    },
    {
      label: 'Nutritionists',
      href: '/admin/nutritionists',
      description: 'Applications, credential screening, and PRC verification.',
      group: 'People',
      icon: Stethoscope,
    },
    {
      label: 'Nutrition data',
      href: '/admin/data',
      description: 'Sources, releases, imports, publication, and FNRI catalogue.',
      group: 'Content & evidence',
      icon: Database,
    },
    {
      label: 'Author meals',
      href: '/admin/meals',
      description: 'Enter complete recipes for nutritionist evidence review.',
      group: 'Content & evidence',
      icon: Soup,
    },
    {
      label: 'Meal library',
      href: '/admin/library',
      description: 'Browse shared recipes and flag meals for nutritionist review.',
      group: 'Content & evidence',
      icon: Soup,
    },
    {
      label: 'Website content',
      href: '/admin/website',
      description: 'Preview and publish the landing-page image or promotional video.',
      group: 'Content & evidence',
      icon: ImageIcon,
    },
    {
      label: 'Admin profile',
      href: '/admin/profile',
      description: 'Account security, appearance, and administrative session controls.',
      group: 'Platform',
      icon: User,
    },
  ],
};

export const primaryWorkspaceTools: Record<WorkspaceRole, WorkspaceTool[]> = {
  USER: workspaceTools.USER.filter((tool) =>
    ['/dashboard', '/meals', '/grocery', '/progress', '/profile'].includes(tool.href)
  ),
  NUTRITIONIST: workspaceTools.NUTRITIONIST,
  ADMIN: [
    '/admin/overview',
    '/admin/users',
    '/admin/nutritionists',
    '/admin/data',
    '/admin/meals',
    '/admin/library',
    '/admin/website',
    '/admin/operations',
    '/admin/analytics',
  ].map((href) => {
    const tool = workspaceTools.ADMIN.find((entry) => entry.href === href)!;
    return {
      ...tool,
      group:
        href === '/admin/overview'
          ? 'Overview'
          : ['/admin/users', '/admin/nutritionists'].includes(href)
            ? 'People'
            : ['/admin/data', '/admin/meals', '/admin/library', '/admin/website'].includes(href)
              ? 'Content & data'
              : 'Operations',
    };
  }),
};
