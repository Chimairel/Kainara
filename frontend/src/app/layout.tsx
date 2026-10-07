import LiveUpdates from '@/components/shared/LiveUpdates';
import PageTitle from '@/components/shared/PageTitle';
import { NotificationsProvider } from '@/hooks/useNotifications';
import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { BreadcrumbProvider } from '@/lib/context/BreadcrumbContext';
import TopNavigationProgress from '@/components/shared/TopNavigationProgress';
import { Toaster } from '@/components/ui/Sonner';
import MobileInstallPrompt from '@/components/shared/MobileInstallPrompt';

// Preload local fonts, but retain the fallback when they arrive after the first paint.
// Late swaps were changing auth heading wrapping during otherwise stable navigation.
const dmSans = localFont({
  src: './fonts/dm-sans.ttf',
  variable: '--font-dm-sans',
  weight: '300 700',
  display: 'optional',
});

const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans.ttf',
  variable: '--font-plus-jakarta-sans',
  weight: '400 800',
  display: 'optional',
});

const outfit = localFont({
  src: './fonts/outfit.ttf',
  variable: '--font-outfit',
  weight: '300 900',
  display: 'optional',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono.ttf',
  variable: '--font-jetbrains-mono',
  weight: '400 700',
  display: 'optional',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060b09',
};

export const metadata: Metadata = {
  title: 'Kainara',
  description:
    'Personalized meal planning with Filipino recipes, food-composition references, nutrition tracking and professional review workflows.',
  keywords: ['nutrition', 'meal planning', 'Filipino food', 'FNRI', 'diet', 'health', 'AI nutrition', 'KAINARA'],
  authors: [{ name: 'KAINARA Team' }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/icon.svg',
    apple: '/icons/icon-192.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Kainara',
    description: 'Personalized AI-powered nutrition for health-conscious Filipinos.',
    type: 'website',
    locale: 'en_PH',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('nutrimind-theme');
                  var theme = saved === 'light' || saved === 'dark' ? saved : 'light';
                  document.documentElement.className = theme;
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable} bg-brand-bg font-sans text-brand-text antialiased`}
      >
        <ThemeProvider>
          <MobileInstallPrompt />
          <Toaster position="bottom-right" richColors />
          <AuthProvider>
            <NotificationsProvider>
              <LiveUpdates />
              <Suspense fallback={null}>
                <PageTitle />
              </Suspense>
              <BreadcrumbProvider>
                <Suspense fallback={null}>
                  <TopNavigationProgress />
                </Suspense>
                {children}
              </BreadcrumbProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
