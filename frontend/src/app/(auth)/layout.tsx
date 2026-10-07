import type { Metadata } from 'next';
import { GOOGLE_SCRIPT_SRC } from '@/components/auth/google-identity-services';

export const metadata: Metadata = {
  title: 'Account access',
  description: 'Securely access your KAINARA nutrition workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" as="script" href={GOOGLE_SCRIPT_SRC} />
      {children}
    </>
  );
}
