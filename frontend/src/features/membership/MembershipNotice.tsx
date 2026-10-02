'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import FloatingNotice from '@/components/shared/FloatingNotice';
import { useMembership } from './MembershipProvider';

export default function MembershipNotice() {
  const { user } = useAuth();
  const { data } = useMembership();
  const [visible, setVisible] = useState(false);
  const dismissedKey = useRef<string | null>(null);
  const key = `kainara-membership-notice:${user?.userId}:${new Date().toISOString().slice(0, 10)}`;
  const left =
    data?.enabled && data.trialEndsAt
      ? new Date(data.trialEndsAt).getTime() - new Date(data.serverTime).getTime()
      : Infinity;
  const eligible = Boolean(
    data?.enabled &&
    data.trialEndsAt &&
    data.level !== 'MEMBER' &&
    left <= 3 * 24 * 60 * 60 * 1000 &&
    left >= -7 * 24 * 60 * 60 * 1000
  );
  useEffect(() => {
    setVisible(false);
    if (!eligible) return;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* Dismissal still works in memory. */
    }
    const timer = window.setInterval(() => {
      if (dismissedKey.current === key) return;
      try {
        if (sessionStorage.getItem(key)) return;
      } catch {
        /* In-memory dismissal remains available. */
      }
      if (document.querySelector('[role="dialog"], [data-floating-notice="install"], [data-floating-notice="auth"]')) {
        setVisible(false);
        return;
      }
      if (document.visibilityState === 'visible' && !document.querySelector('[role="dialog"], [data-floating-notice]'))
        setVisible(true);
    }, 8_000);
    const observer = new MutationObserver(() => {
      if (document.querySelector('[role="dialog"], [data-floating-notice="install"], [data-floating-notice="auth"]'))
        setVisible(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [eligible, key]);
  if (!visible || !data?.enabled) return null;
  const expired = data.level === 'FREE';
  return (
    <FloatingNotice
      kind="membership"
      title={expired ? 'Your trial has ended' : 'Your membership trial'}
      onClose={() => {
        dismissedKey.current = key;
        try {
          sessionStorage.setItem(key, '1');
        } catch {
          /* No stored health or billing data. */
        }
        setVisible(false);
      }}
    >
      <p>
        {expired
          ? data.requiresCaseReview
            ? 'New plans with case review need membership. Your existing eligible active cycle can finish.'
            : 'Your general weekly plans continue. Adaptive planning and progress insights are membership benefits.'
          : `Your trial ends ${new Date(data.trialEndsAt!).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}. Membership includes adaptive planning, progress insights and review when required.`}
      </p>
      <p>View plans to compare benefits and checkout availability.</p>
      <Link href="/membership" className="inline-block font-bold text-brand-green">
        View membership →
      </Link>
    </FloatingNotice>
  );
}
