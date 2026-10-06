'use client';

import React from 'react';
import Link from 'next/link';

export interface AnnouncementBannerAction {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export interface AnnouncementBannerProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  badge?: React.ReactNode;
  action?: AnnouncementBannerAction;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  variant?: 'clinical' | 'warning' | 'info' | 'success';
}

const informationStyle = { surface: 'bg-[#075e54] text-white', action: 'text-[#075e54]' };
const variantStyles = {
  clinical: informationStyle,
  warning: { surface: 'bg-[#8c3b00] text-white', action: 'text-[#8c3b00]' },
  info: informationStyle,
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
  const theme = variantStyles[variant] || variantStyles.warning;
  const actionClasses = `inline-flex items-center justify-center rounded-xl bg-white px-3 py-1 text-xs font-bold ${theme.action} shadow-sm hover:bg-white/90 transition-all shrink-0 ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${action?.className || ''}`;

  return (
    <aside
      aria-label={ariaLabel}
      className={`w-full rounded-2xl ${theme.surface} px-4 py-2.5 text-center text-xs font-medium shadow-sm sm:text-sm flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      {title && <span className="font-bold">{title}</span>}
      {badge}
      {message && <span className="text-white/90">{message}</span>}
      {children}
      {action &&
        (action.href ? (
          <Link href={action.href} className={actionClasses}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClasses}>
            {action.label}
          </button>
        ))}
    </aside>
  );
}
