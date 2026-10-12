'use client';

import React from 'react';
import { ClipboardList, Soup, ScrollText } from '@/components/ui/icons';
import PortalRoleLayout from '@/components/shared/PortalRoleLayout';
import NutritionistCredentialGate from '@/features/nutritionist-license/NutritionistCredentialGate';

const navItems = [
  { href: '/nutritionist/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/nutritionist/library', label: 'Library', icon: Soup },
  { href: '/nutritionist/audit', label: 'Audit', icon: ScrollText },
];

export default function NutritionistLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalRoleLayout navItems={navItems}>
      <NutritionistCredentialGate>{children}</NutritionistCredentialGate>
    </PortalRoleLayout>
  );
}
