import type { Metadata } from 'next';
import { GOOGLE_SCRIPT_SRC } from '@/components/auth/google-identity-services';
import { GOOGLE_BUTTON_FONT_SRC } from '@/components/auth/google-button-font';

export const metadata: Metadata = {
  title: 'Account access',
  description: 'Securely access your KAINARA nutrition workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" as="script" href={GOOGLE_SCRIPT_SRC} />
      <link rel="preload" as="font" type="font/woff2" href={GOOGLE_BUTTON_FONT_SRC} crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {children}
    </>
  );
}
