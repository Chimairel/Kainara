'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@/components/ui/icons';
import { useDesktopWorkspaceVisible } from '@/lib/desktop-workspace-visibility';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  presentation?: 'default' | 'workspace';
  headerContent?: React.ReactNode;
  layer?: 'default' | 'canvas';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  contentClassName = '',
  presentation = 'default',
  headerContent,
  size = 'md',
  layer = 'default',
}) => {
  const desktopVisible = useDesktopWorkspaceVisible();
  const workspace = presentation === 'workspace';
  const opener = React.useRef<HTMLElement | null>(null);
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    '4xl': 'max-w-6xl',
  };

  return (
    <Dialog.Root open={isOpen && desktopVisible} onOpenChange={(open) => desktopVisible && !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 ${layer === 'canvas' ? 'z-[100]' : 'z-50'} bg-[#020806]/75 ${workspace ? 'transition-opacity duration-200 motion-reduce:transition-none' : 'backdrop-blur-md transition-all duration-300'}`}
        />
        <Dialog.Content
          onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={(event) => {
            if (!desktopVisible) { event.preventDefault(); return; }
            if (opener.current?.isConnected && opener.current !== document.body) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          className={`
            fixed left-1/2 top-1/2 ${layer === 'canvas' ? 'z-[101]' : 'z-50'} w-[92vw] ${sizeClasses[size]}
            ${workspace ? 'max-h-[90dvh] overflow-hidden p-0' : `max-h-[90vh] ${layer === 'canvas' ? 'overflow-hidden' : 'overflow-y-auto'} p-6`} -translate-x-1/2 -translate-y-1/2 rounded-[28px]
            border border-brand-border bg-brand-surface text-brand-text shadow-card-lg
            outline-none ${workspace ? '' : 'transition-all duration-300'}
          `}
        >
          <div className={`flex min-h-0 flex-col ${workspace ? 'max-h-[90dvh]' : `gap-4 ${layer === 'canvas' ? 'max-h-[calc(90dvh-3rem)]' : ''}`}`}>
            <div className={`flex shrink-0 items-start justify-between gap-5 ${workspace ? 'border-b border-brand-border px-5 py-5 sm:px-7 sm:py-6' : ''}`}>
              <div className="min-w-0">
                <Dialog.Title className="font-display text-xl font-bold tracking-tight text-brand-text">
                  {title}
                </Dialog.Title>
                <Dialog.Description
                  className={description ? 'mt-1 text-sm leading-relaxed text-brand-muted' : 'sr-only'}
                >
                  {description || `${title} dialog`}
                </Dialog.Description>
                {headerContent}
              </div>
              <Dialog.Close
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-bgAlt text-brand-muted outline-none transition-colors hover:border-brand-green hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green/30"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <div
              className={`text-sm leading-relaxed text-brand-text ${workspace ? 'min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7 custom-scrollbar' : `py-2 ${layer === 'canvas' ? 'min-h-0 overflow-y-auto overscroll-contain pr-2 custom-scrollbar' : ''}`} ${contentClassName}`}
            >
              {children}
            </div>
            {footer && (
              <div className={`flex shrink-0 items-center justify-end gap-3 border-t border-brand-border ${workspace ? 'bg-brand-bgAlt/40 px-5 py-4 sm:px-7' : 'mt-2 pt-4'}`}>
                {footer}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
