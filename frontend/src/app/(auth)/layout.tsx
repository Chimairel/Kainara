import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Account access',
  description: 'Securely access your KAINARA nutrition workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      {children}
    </>
  );
}
