'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { licenseDate, type CredentialStatus } from './types';

type StatusQuery = ReturnType<typeof useSessionQuery<CredentialStatus>>;
const CredentialContext = createContext<StatusQuery | null>(null);
export const useCredentialStatus = () => useContext(CredentialContext);
export default function NutritionistCredentialGate({ children }: { children: ReactNode }) {
  const ownerId = useAuth().user?.userId;
  const path = usePathname();
  const query = useSessionQuery<CredentialStatus>({
    ownerId,
    resource: 'rnd-credential-status',
    pollIntervalMs: 60000,
    errorMessage: 'Your professional access status could not be checked. Please try again.',
    fetcher: async () => {
      const response = await api.get('/nutritionist/credential-status');
      if (!response.data?.success) throw new Error('Credential status unavailable.');
      return response.data.data;
    },
  });
  const maintenance = path === '/nutritionist/profile';
  return (
    <CredentialContext.Provider value={query}>
      {maintenance || query.data?.eligible ? (
        children
      ) : !query.data && query.isLoading ? (
        <PortalLoadingState fillContainer message="Checking professional access…" />
      ) : (
        <section className="portal-page max-w-3xl space-y-5" aria-labelledby="credential-access-title">
          <ShieldAlert className="h-8 w-8 text-status-warning-text" aria-hidden="true" />
          <div className="space-y-2">
            <h1 id="credential-access-title" className="font-display text-2xl font-bold text-brand-text">
              {query.error
                ? 'Professional access could not be checked'
                : query.data?.reason === 'LICENSE_EXPIRED'
                  ? 'Your recorded license has expired'
                  : 'Professional access needs attention'}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-brand-muted">
              {query.error ??
                (query.data?.reason === 'LICENSE_EXPIRED'
                  ? `The saved PRC license expired on ${licenseDate(query.data.expiryDate)}. You can submit a renewal or correct an incorrectly recorded date from your RND profile. Review actions remain unavailable until an administrator approves a current credential.`
                  : 'Open your RND profile to check your credential status. Contact an administrator if your application or verification needs attention.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/nutritionist/profile#license-update" className={buttonStyles({ variant: 'secondary' })}>
              Open RND profile
            </Link>
            <Button variant="ghost" disabled={query.isLoading} onClick={() => void query.refetch()}>
              Check again
            </Button>
          </div>
        </section>
      )}
    </CredentialContext.Provider>
  );
}
