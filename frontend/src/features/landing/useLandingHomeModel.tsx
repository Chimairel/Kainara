'use client';
import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import type { LandingMedia } from '@/features/website-content/types';

import { useAuth } from '@/hooks/useAuth';

import { getRoleHome } from './LandingHome.shared';
export function useLandingHomeModel({ initialMedia }: { initialMedia: LandingMedia | null }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.emailVerified) {
      const destination =
        user.role === 'ADMIN'
          ? '/admin/overview'
          : user.role === 'NUTRITIONIST'
            ? '/nutritionist/reviews'
            : !user.onboardingDone
              ? user.onboardingNextPath || '/onboarding/stats'
              : !user.tosAccepted
                ? '/onboarding/tos'
                : '/dashboard';
      router.replace(destination);
    }
  }, [user, isLoading, router]);

  const isPendingVerification = Boolean(user && !user.emailVerified);
  const workspaceHref = user ? (isPendingVerification ? '/verify-email' : getRoleHome(user.role)) : '/register';
  const workspaceLabel = user
    ? isPendingVerification
      ? 'Continue email verification'
      : user.role === 'USER'
        ? 'Go to Dashboard'
        : 'Open Portal'
    : 'Build my profile';

  // Pending verification can browse the public home page. Its call to action
  // still leads back to verification; protected routes remain gated.
  if (user?.emailVerified) {
    return { kind: 'early' as const, view: null };
  }

  return { kind: 'ready' as const, workspaceHref, workspaceLabel, initialMedia };
}
