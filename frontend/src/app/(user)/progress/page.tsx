'use client';

import { ProgressWorkspace } from '@/components/user/ProgressWorkspace';
import MembershipGate from '@/features/membership/MembershipGate';

export default function ProgressPage() {
  return (
    <MembershipGate benefit="Progress insights">
      <ProgressWorkspace />
    </MembershipGate>
  );
}
