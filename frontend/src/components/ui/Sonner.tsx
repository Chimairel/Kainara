'use client';

import React from 'react';
import { useTheme } from '@/lib/context/ThemeContext';
import { Toaster as Sonner, toast } from 'sonner';
import { usePathname } from 'next/navigation';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ position = 'bottom-right', ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const memberPage = /^\/(dashboard|meals|grocery|progress|profile|export)(\/|$)/.test(usePathname() ?? '');

  return (
    <Sonner
      theme={(theme as ToasterProps['theme']) || 'system'}
      position={position}
      className={`toaster group${memberPage ? ' member-toaster' : ''}`}
      mobileOffset={{ bottom: memberPage ? 'calc(100px + env(safe-area-inset-bottom))' : '24px', left: '16px', right: '16px' }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-brand-surface group-[.toaster]:text-brand-text group-[.toaster]:border-brand-border group-[.toaster]:shadow-card-lg group-[.toaster]:rounded-2xl',
          description: 'group-[.toast]:text-brand-muted',
          actionButton: 'group-[.toast]:bg-brand-green group-[.toast]:text-white dark:group-[.toast]:text-brand-black group-[.toast]:font-semibold',
          cancelButton: 'group-[.toast]:bg-brand-bgAlt group-[.toast]:text-brand-muted',
        },
      }}
      {...props}
    />
  );
};

export { toast };
export default Toaster;
