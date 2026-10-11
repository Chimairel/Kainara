'use client';

import React, { createContext, useContext } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';

export const CompactAnnouncementContext = createContext(false);

export interface AnnouncementBannerAction {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Prevent duplicate submissions for button actions while a request is running. */
  disabled?: boolean;
}

export interface AnnouncementBannerProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  badge?: React.ReactNode;
  action?: AnnouncementBannerAction;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  variant?: 'clinical' | 'warning' | 'info' | 'blue' | 'success';
}

const informationStyle = { surface: 'bg-[#075e54] text-white', action: 'text-[#075e54]' };
const variantStyles = {
  clinical: informationStyle,
  warning: { surface: 'bg-[#8c3b00] text-white', action: 'text-[#8c3b00]' },
  info: informationStyle,
  blue: { surface: 'bg-[#075985] text-white', action: 'text-[#075985]' },
  success: { surface: 'bg-[#166534] text-white', action: 'text-[#166534]' },
};

export default function AnnouncementBanner({
  title,
  message,
  badge,
  action,
  children,
  className = '',
  ariaLabel = 'Important announcement',
  variant = 'warning',
}: AnnouncementBannerProps) {
  const compact = useContext(CompactAnnouncementContext);
  const theme = variantStyles[variant] || variantStyles.warning;
  const actionClasses = buttonStyles({ variant: 'secondary', size: 'sm', className: action?.className });

  return (
    <aside
      aria-label={ariaLabel}
      className={`${compact ? 'flex w-full flex-wrap items-start gap-x-4 gap-y-3 py-4 text-left text-sm text-brand-text' : `w-full rounded-2xl ${theme.surface} px-4 py-2.5 text-center text-xs font-medium shadow-sm sm:text-sm flex flex-wrap items-center justify-center gap-2`} ${className}`}
    >
      <div className={compact ? 'min-w-0 flex-1 basis-64 space-y-1' : 'contents'}>
        {title && <span className="font-bold">{title}</span>}
        {badge}
        {message && (
          <span className={compact ? 'block max-w-prose leading-6 text-brand-muted' : 'text-white/90'}>{message}</span>
        )}
        {children}
      </div>
      {action &&
        (action.href ? (
          <Link href={action.href} className={actionClasses}>
            {action.label}
          </Link>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={action.className}
          >
            {action.label}
          </Button>
        ))}
    </aside>
  );
}
