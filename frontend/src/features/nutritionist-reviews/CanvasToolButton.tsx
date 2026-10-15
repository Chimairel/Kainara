'use client';
import type { ButtonHTMLAttributes } from 'react';
import { MessageSquare } from '@/components/ui/icons';
import CanvasTooltip from './CanvasTooltip';

/** Unscaled task controls alongside the canvas navigation tools. */
export default function CanvasToolButton({ children, title, className = '', tooltipPlacement = 'top', tooltipAlign = 'center', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tooltipPlacement?: 'top' | 'bottom'; tooltipAlign?: 'start' | 'center' | 'end' }) {
  const label = props['aria-label'] ?? title ?? (typeof children === 'string' ? children : undefined);
  return <CanvasTooltip label={title ?? label ?? 'Canvas tool'} placement={tooltipPlacement} align={tooltipAlign}>{descriptionId => <button {...props} type="button" aria-label={label} aria-describedby={descriptionId}
    className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 text-brand-text enabled:hover:bg-brand-green/10 aria-pressed:bg-brand-green/15 aria-pressed:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:!text-brand-muted disabled:!bg-transparent disabled:opacity-50 ${className}`}>
    {typeof children === 'string' ? <MessageSquare aria-hidden="true" className="h-5 w-5" /> : children}
  </button>}</CanvasTooltip>;
}
