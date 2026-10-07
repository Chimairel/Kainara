import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function AuthFormPrelude({ error, children }: { error?: string | null; children: ReactNode }) {
  return (
    <>
      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-5">{error}</span>
        </div>
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
    </>
  );
}
