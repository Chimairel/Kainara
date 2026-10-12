import FeedbackNotice from '@/components/shared/FeedbackNotice';

import type { ReactNode } from 'react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function AuthFormPrelude({
  error,
  errorTitle,
  children,
}: {
  error?: string | null;
  errorTitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[400px]">
      {error ? (
        <FeedbackNotice className="mb-5" title={errorTitle}>
          <span className="leading-5">{error}</span>
        </FeedbackNotice>
      ) : null}
      {children}
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE' && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-brand-border" />
              <span className="shrink-0 text-xs text-brand-muted">Or continue with</span>
              <div className="h-px flex-1 bg-brand-border" />
            </div>
            <GoogleSignInButton />
          </>
        )}
    </div>
  );
}
